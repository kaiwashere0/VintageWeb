import os from 'os';
import mongoose from 'mongoose';
import DiscordBotService from '../discord-bot/index.js';
import { LOCALES } from '../i18n/index.js';

class TelemetryEngine {
  constructor() {
    this.startTime = Date.now();
    this.requestLogs = [];
    this.errorLogs = [];
    this.maxLogs = 2000;
    this.maxErrors = 500;
    this.lastUpstreamPing = null;
    this.upstreamLatency = 0;

    // Periodic system snapshot (every 10 seconds)
    this.history = [];
    this.maxHistory = 120; // 20 minutes of 10s intervals

    this.startSystemTicker();
  }

  startSystemTicker() {
    setInterval(() => {
      const mem = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const snapshot = {
        timestamp: new Date().toISOString(),
        time: Date.now(),
        heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(2),
        rssMB: +(mem.rss / 1024 / 1024).toFixed(2),
        cpuPercent: +((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(1),
        activeRequests: this.requestLogs.filter(r => Date.now() - r.time < 60000).length
      };

      this.history.push(snapshot);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
    }, 10000);
  }

  /**
   * Express Middleware to automatically track all requests and latencies
   */
  middleware() {
    return (req, res, next) => {
      const start = process.hrtime();
      const startTime = Date.now();

      res.on('finish', () => {
        const diff = process.hrtime(start);
        const durationMs = +(diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        
        // Exclude static assets unless they error
        if (req.path.startsWith('/public') && res.statusCode < 400) return;

        this.recordRequest({
          id: 'req_' + Math.random().toString(36).substring(2, 9),
          method: req.method,
          path: req.originalUrl || req.url,
          status: res.statusCode,
          durationMs,
          ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
          timestamp: new Date().toISOString(),
          time: startTime
        });

        // Auto log 5xx server errors
        if (res.statusCode >= 500) {
          this.logError('API Microservice', `HTTP ${res.statusCode} on ${req.method} ${req.path}`, '', 'ERROR', {
            status: res.statusCode,
            ip: req.ip
          });
        }
      });

      next();
    };
  }

  /**
   * Record HTTP request metric
   */
  recordRequest(entry) {
    this.requestLogs.unshift(entry);
    if (this.requestLogs.length > this.maxLogs) {
      this.requestLogs.pop();
    }
  }

  /**
   * Record an error / alert into error telemetry
   */
  logError(service, message, stack = '', severity = 'ERROR', metadata = {}) {
    const errorEntry = {
      id: 'err_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      service,
      message,
      stack: stack ? String(stack) : '',
      severity: severity.toUpperCase(), // INFO, WARN, ERROR, CRITICAL
      metadata,
      timestamp: new Date().toISOString(),
      time: Date.now()
    };

    this.errorLogs.unshift(errorEntry);
    if (this.errorLogs.length > this.maxErrors) {
      this.errorLogs.pop();
    }

    // Dispatch to vweb-system-errors channel
    if (['ERROR', 'CRITICAL'].includes(severity.toUpperCase())) {
      import('../discord-bot/index.js').then(({ DiscordBotService }) => {
        DiscordBotService.sendLog('systemErrors', {
          enTitle: `System Error Alert: [${service}]`,
          trTitle: `Sistem Hata Bildirimi: [${service}]`,
          enDesc: `An unexpected backend exception or error code was captured by telemetry.`,
          trDesc: `Telemetri tarafından yakalanan beklenmeyen bir sunucu hatası gerçekleşti.`,
          emojiKey: 'no',
          actor: service,
          ansiLines: [
            `\u001b[1;31m[SEVERITY: ${severity.toUpperCase()}]\u001b[0m ${service}`,
            `\u001b[0;37m[MESSAGE]\u001b[0m ${message}`,
            `\u001b[0;36m[ERROR ID]\u001b[0m ${errorEntry.id}`
          ],
          treeItems: [
            { enKey: 'Service Source', trKey: 'Kaynak Servis', val: service },
            { enKey: 'Severity Level', trKey: 'Önem Derecesi', val: severity.toUpperCase() },
            { enKey: 'Error Message', trKey: 'Hata Mesajı', val: message }
          ]
        }).catch(() => null);
      }).catch(() => null);
    }

    return errorEntry;
  }

  /**
   * Microservices live health check aggregator
   */
  async getMicroservicesStatus() {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const results = {};

    // 1. Database Microservice (MongoDB)
    const mongoState = mongoose.connection.readyState;
    const mongoStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    const mongoStateStr = mongoStatusMap[mongoState] || 'unknown';
    
    let dbPing = 0;
    let collectionsCount = 0;
    if (mongoState === 1 && mongoose.connection.db) {
      const pingStart = Date.now();
      try {
        await mongoose.connection.db.admin().ping();
        dbPing = Date.now() - pingStart;
        const colls = await mongoose.connection.db.listCollections().toArray();
        collectionsCount = colls.length;
      } catch (err) {
        dbPing = -1;
      }
    }

    results.database = {
      name: 'Database Microservice',
      serviceId: 'mongodb_mongoose',
      type: 'Core Data Layer',
      status: mongoState === 1 ? 'healthy' : (mongoState === 2 ? 'degraded' : 'offline'),
      state: mongoStateStr,
      latencyMs: dbPing >= 0 ? dbPing : 'timeout',
      host: mongoose.connection.host || '127.0.0.1',
      port: mongoose.connection.port || 27017,
      dbName: mongoose.connection.name || 'vintage_club',
      collectionsCount,
      modelsCount: Object.keys(mongoose.models).length,
      uptimeSeconds: uptimeSec,
      lastCheck: new Date().toISOString()
    };

    // 2. Discord Bot Microservice
    const botClient = DiscordBotService?.client;
    const isBotReady = botClient && botClient.isReady ? botClient.isReady() : false;
    const botPing = isBotReady ? (botClient.ws?.ping || 12) : null;

    results.discordBot = {
      name: 'Discord Bot Microservice',
      serviceId: 'discord_gateway_v10',
      type: 'Community & Event Gateway',
      status: isBotReady ? 'healthy' : (process.env.DISCORD_BOT_TOKEN ? 'standby' : 'offline'),
      tag: isBotReady ? botClient.user.tag : 'Vintage Club#5492',
      pingMs: botPing !== null ? botPing : 'N/A',
      guildsCount: isBotReady ? botClient.guilds.cache.size : 0,
      uptimeSeconds: uptimeSec,
      lastCheck: new Date().toISOString()
    };

    // 3. Auth & Session Microservice
    results.auth = {
      name: 'Auth & Session Microservice',
      serviceId: 'discord_oauth2_session',
      type: 'Identity & Access Control',
      status: 'healthy',
      provider: 'Discord OAuth2 (API v10)',
      secretConfigured: Boolean(process.env.SESSION_SECRET),
      superAdminsConfigured: (process.env.SUPER_ADMIN_IDS || '').split(',').filter(Boolean).length,
      developersConfigured: (process.env.DEVELOPER_IDS || process.env.SUPER_ADMIN_IDS || '').split(',').filter(Boolean).length,
      uptimeSeconds: uptimeSec,
      lastCheck: new Date().toISOString()
    };

    // 4. i18n Localization Microservice
    const availableLangs = Object.keys(LOCALES);
    const keyCounts = {};
    availableLangs.forEach(lang => {
      keyCounts[lang] = Object.keys(LOCALES[lang] || {}).length;
    });

    results.i18n = {
      name: 'i18n Localization Microservice',
      serviceId: 'geoip_i18n_locales',
      type: 'Global Language Engine',
      status: 'healthy',
      languages: availableLangs,
      defaultLang: 'en',
      keyCounts,
      geoDetection: 'geoip-lite active',
      uptimeSeconds: uptimeSec,
      lastCheck: new Date().toISOString()
    };

    // 5. TruckersMP Web API Microservice
    results.truckersmp = {
      name: 'TruckersMP Web API v2 Microservice',
      serviceId: 'truckersmp_rest_v2',
      type: 'External Simulation Fleet API',
      status: this.upstreamLatency >= 0 ? 'healthy' : 'degraded',
      baseUrl: process.env.TRUCKERSMP_API_BASE_URL || 'https://api.truckersmp.com/v2',
      latencyMs: this.upstreamLatency,
      lastPing: this.lastUpstreamPing,
      activeRoutes: [
        '/player/{id}',
        '/bans/{id}',
        '/servers',
        '/game_time',
        '/events',
        '/events/{id}',
        '/vtc/{id}',
        '/vtc/{id}/members',
        '/vtc/{id}/events',
        '/version',
        '/rules'
      ],
      uptimeSeconds: uptimeSec,
      lastCheck: new Date().toISOString()
    };

    return results;
  }

  /**
   * Ping upstream TruckersMP API to check health
   */
  async pingTruckersMP() {
    const start = Date.now();
    try {
      const baseUrl = process.env.TRUCKERSMP_API_BASE_URL || 'https://api.truckersmp.com/v2';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const res = await fetch(`${baseUrl}/version`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      this.upstreamLatency = Date.now() - start;
      this.lastUpstreamPing = new Date().toISOString();
      return { success: res.ok, latencyMs: this.upstreamLatency };
    } catch (err) {
      this.upstreamLatency = -1;
      this.lastUpstreamPing = new Date().toISOString();
      this.logError('TruckersMP Web API', `Upstream ping failed: ${err.message}`, err.stack, 'WARN');
      return { success: false, latencyMs: -1, error: err.message };
    }
  }

  /**
   * Query Telemetry with rich multi-dimensional filtering & sorting
   */
  getTelemetryData(query = {}) {
    const {
      service = 'ALL',
      level = 'ALL',
      timeRange = '1h', // 15m, 1h, 24h, 7d, all
      statusCode = 'ALL', // ALL, 2xx, 3xx, 4xx, 5xx
      search = '',
      sortBy = 'timestamp', // timestamp, latency, status
      sortOrder = 'desc' // asc, desc
    } = query;

    const now = Date.now();
    let timeLimitMs = 60 * 60 * 1000; // 1h default
    if (timeRange === '15m') timeLimitMs = 15 * 60 * 1000;
    else if (timeRange === '24h') timeLimitMs = 24 * 60 * 60 * 1000;
    else if (timeRange === '7d') timeLimitMs = 7 * 24 * 60 * 60 * 1000;
    else if (timeRange === 'all') timeLimitMs = Infinity;

    // Filter Requests
    let filteredRequests = this.requestLogs.filter(r => {
      if (timeLimitMs !== Infinity && (now - r.time > timeLimitMs)) return false;
      if (statusCode === '2xx' && (r.status < 200 || r.status >= 300)) return false;
      if (statusCode === '3xx' && (r.status < 300 || r.status >= 400)) return false;
      if (statusCode === '4xx' && (r.status < 400 || r.status >= 500)) return false;
      if (statusCode === '5xx' && r.status < 500) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!r.path.toLowerCase().includes(s) && !r.method.toLowerCase().includes(s) && !String(r.status).includes(s)) {
          return false;
        }
      }
      return true;
    });

    // Sort Requests
    filteredRequests.sort((a, b) => {
      if (sortBy === 'latency') {
        return sortOrder === 'asc' ? a.durationMs - b.durationMs : b.durationMs - a.durationMs;
      }
      if (sortBy === 'status') {
        return sortOrder === 'asc' ? a.status - b.status : b.status - a.status;
      }
      return sortOrder === 'asc' ? a.time - b.time : b.time - a.time;
    });

    // Filter Error Logs
    let filteredErrors = this.errorLogs.filter(e => {
      if (timeLimitMs !== Infinity && (now - e.time > timeLimitMs)) return false;
      if (service !== 'ALL' && !e.service.toLowerCase().includes(service.toLowerCase())) return false;
      if (level !== 'ALL' && e.severity !== level.toUpperCase()) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!e.message.toLowerCase().includes(s) && !e.service.toLowerCase().includes(s) && !e.severity.toLowerCase().includes(s)) {
          return false;
        }
      }
      return true;
    });

    // Sort Errors
    filteredErrors.sort((a, b) => {
      return sortOrder === 'asc' ? a.time - b.time : b.time - a.time;
    });

    // Compute Metrics Aggregates
    const totalRequests = filteredRequests.length;
    const avgLatency = totalRequests > 0 
      ? +(filteredRequests.reduce((acc, r) => acc + r.durationMs, 0) / totalRequests).toFixed(2)
      : 0;
    
    const count2xx = filteredRequests.filter(r => r.status >= 200 && r.status < 300).length;
    const count3xx = filteredRequests.filter(r => r.status >= 300 && r.status < 400).length;
    const count4xx = filteredRequests.filter(r => r.status >= 400 && r.status < 500).length;
    const count5xx = filteredRequests.filter(r => r.status >= 500).length;

    // Time-series slices for charts (last 30 request latency samples)
    const latencyTimeSeries = filteredRequests.slice(0, 30).reverse().map(r => ({
      time: new Date(r.time).toLocaleTimeString(),
      latency: r.durationMs,
      status: r.status,
      path: r.path
    }));

    return {
      overview: {
        totalRequests,
        avgLatencyMs: avgLatency,
        totalErrors: filteredErrors.length,
        statusBreakdown: {
          '2xx': count2xx,
          '3xx': count3xx,
          '4xx': count4xx,
          '5xx': count5xx
        },
        uptimeSeconds: Math.floor((now - this.startTime) / 1000)
      },
      charts: {
        latencyTimeSeries,
        systemHistory: this.history,
        statusDistribution: [count2xx, count3xx, count4xx, count5xx]
      },
      requests: filteredRequests.slice(0, 100),
      errors: filteredErrors.slice(0, 100)
    };
  }

  /**
   * Clear error logs buffer
   */
  clearErrorLogs() {
    this.errorLogs = [];
    return { success: true, message: 'Error telemetry buffer cleared.' };
  }
}

const TelemetryService = new TelemetryEngine();
export default TelemetryService;
export { TelemetryService };
