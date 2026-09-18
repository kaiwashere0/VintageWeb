import express from 'express';
import os from 'os';
import { isDeveloper } from '../auth/index.js';
import TelemetryService from '../telemetry/index.js';
import TruckersMPService from '../truckersmp/index.js';
import DatabaseService, { Application, Event, Member, Gallery, User, Settings, Subscriber } from '../database/index.js';

export function requireDeveloper(req, res, next) {
  const user = req.session?.user;

  if (!user) {
    return res.redirect('/auth/discord?redirect=/developer');
  }

  const isDev = isDeveloper(user.discordId) || user.isDeveloper || user.role === 'Developer' || user.isSuperAdmin;

  if (isDev) {
    req.session.user.isDeveloper = true;
    return next();
  }

  return res.status(403).render('developer/access-denied', {
    title: 'Developer Access Denied — Vintage Club',
    currentPath: '/developer',
    user
  });
}

export function createDeveloperRouter() {
  const router = express.Router();

  // Protect all /developer routes
  router.use(requireDeveloper);

  // 1. Developer Dashboard (Overview & Telemetry Hub)
  router.get(['/', '/dashboard'], async (req, res) => {
    try {
      const [microservices, telemetryData] = await Promise.all([
        TelemetryService.getMicroservicesStatus(),
        TelemetryService.getTelemetryData({ timeRange: '1h' })
      ]);

      const systemInfo = {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        nodeVersion: process.version,
        pid: process.pid,
        totalMemGB: +(os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
        freeMemGB: +(os.freemem() / 1024 / 1024 / 1024).toFixed(2),
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        uptimeSeconds: Math.floor(process.uptime())
      };

      res.render('developer/dashboard', {
        title: "Developer's Control Hub — Vintage Club",
        currentPath: '/developer',
        user: req.session.user,
        systemInfo,
        microservices,
        telemetry: telemetryData
      });
    } catch (err) {
      TelemetryService.logError('Developer Portal', `Dashboard load error: ${err.message}`, err.stack, 'ERROR');
      res.status(500).send('Developer Dashboard Error: ' + err.message);
    }
  });

  // 2. Microservices Management
  router.get('/microservices', async (req, res) => {
    try {
      const microservices = await TelemetryService.getMicroservicesStatus();
      const telemetryData = TelemetryService.getTelemetryData({ timeRange: '24h' });

      res.render('developer/microservices', {
        title: 'Microservice Controller — Developer Portal',
        currentPath: '/developer/microservices',
        user: req.session.user,
        microservices,
        errorLogs: telemetryData.errors
      });
    } catch (err) {
      res.status(500).send('Microservice Controller Error: ' + err.message);
    }
  });

  // 3. TruckersMP Web API Console & Explorer
  router.get('/truckersmp', async (req, res) => {
    try {
      const microservices = await TelemetryService.getMicroservicesStatus();
      const [versionData, rulesData, serversData] = await Promise.all([
        TruckersMPService.getVersion(),
        TruckersMPService.getRules(),
        TruckersMPService.getServers()
      ]);

      res.render('developer/truckersmp', {
        title: 'TruckersMP Web API v2 Console — Developer Portal',
        currentPath: '/developer/truckersmp',
        user: req.session.user,
        tmpService: microservices.truckersmp,
        version: versionData,
        rules: rulesData,
        servers: serversData
      });
    } catch (err) {
      res.status(500).send('TruckersMP Console Error: ' + err.message);
    }
  });

  // 4. Telemetry Full Analytics & Filtering Page
  router.get('/telemetry', async (req, res) => {
    try {
      const telemetryData = TelemetryService.getTelemetryData({ timeRange: '1h' });

      res.render('developer/telemetry', {
        title: 'Telemetry & Event Stream — Developer Portal',
        currentPath: '/developer/telemetry',
        user: req.session.user,
        telemetry: telemetryData
      });
    } catch (err) {
      res.status(500).send('Telemetry Page Error: ' + err.message);
    }
  });

  // 5. Discord Bot Controller & Presence Manager
  router.get('/discord-bot', async (req, res) => {
    try {
      const DiscordBotService = (await import('../discord-bot/index.js')).default;
      const microservices = await TelemetryService.getMicroservicesStatus();
      const botSettings = await DatabaseService.getBotSettings();
      const voiceStatus = DiscordBotService.getVoiceStatus();

      res.render('developer/discord-bot', {
        title: 'Discord Bot Controller — Developer Portal',
        currentPath: '/developer/discord-bot',
        user: req.session.user,
        botSettings,
        botService: microservices.discordBot,
        isClientConnected: Boolean(DiscordBotService?.client?.user),
        voiceStatus
      });
    } catch (err) {
      res.status(500).send('Discord Bot Controller Error: ' + err.message);
    }
  });

  // ==========================================
  // Developer REST API Endpoints (AJAX & Charts)
  // ==========================================

  // Discord Bot Presence API (Get & Live Update)
  router.get('/api/bot/presence', async (req, res) => {
    try {
      const botSettings = await DatabaseService.getBotSettings();
      res.json({ success: true, botSettings });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/api/bot/presence', async (req, res) => {
    try {
      const {
        statusType = 'STREAMING',
        streamingUrl = 'https://twitch.tv/vintageclub',
        statusMode = 'ROTATING',
        statuses = [],
        rotationIntervalSeconds = 15,
        onlineStatus = 'online'
      } = req.body;

      // Ensure statuses is an array of clean non-empty strings
      let cleanStatuses = [];
      if (Array.isArray(statuses)) {
        cleanStatuses = statuses.map(s => String(s).trim()).filter(Boolean);
      } else if (typeof statuses === 'string') {
        cleanStatuses = statuses.split('\n').map(s => s.trim()).filter(Boolean);
      }

      if (cleanStatuses.length === 0) {
        cleanStatuses = ['👑 Vintage Club | 2026', '🚛 Nobility on the Roads'];
      }

      const botPayload = {
        statusType: String(statusType).toUpperCase(),
        streamingUrl: String(streamingUrl).trim(),
        statusMode: String(statusMode).toUpperCase() === 'STATIC' ? 'STATIC' : 'ROTATING',
        statuses: cleanStatuses,
        rotationIntervalSeconds: Math.max(5, parseInt(rotationIntervalSeconds, 10) || 15),
        onlineStatus: ['online', 'idle', 'dnd', 'invisible'].includes(onlineStatus) ? onlineStatus : 'online'
      };

      const updated = await DatabaseService.updateBotSettings(botPayload);

      // Trigger hot presence reload on live Discord bot instance
      const DiscordBotService = (await import('../discord-bot/index.js')).default;
      await DiscordBotService.reloadPresence();

      // Dispatch to vweb-bot-presence
      const devName = req.session.user?.globalName || req.session.user?.username || 'Developer';
      DiscordBotService.sendLog('botPresence', {
        enTitle: `Bot Presence & Streaming Updated by ${devName}`,
        trTitle: `Bot Canlı Yayın & Durum Ayarları Güncellendi (Geliştirici: ${devName})`,
        enDesc: `Discord bot live status mode set to \`${botPayload.statusMode}\` with activity \`${botPayload.statusType}\`.`,
        trDesc: `Discord bot canlı durum modu \`${botPayload.statusMode}\` ve aktivite türü \`${botPayload.statusType}\` olarak güncellendi.`,
        emojiKey: 'yes',
        actor: devName,
        ansiLines: [
          `\u001b[1;35m[BOT PRESENCE]\u001b[0m Hot Reload Applied`,
          `\u001b[0;36m[ACTIVITY]\u001b[0m ${botPayload.statusType} (${botPayload.statusMode})`,
          `\u001b[0;32m[ONLINE STATUS]\u001b[0m ${botPayload.onlineStatus.toUpperCase()}`,
          `\u001b[0;33m[ROTATION INTERVAL]\u001b[0m ${botPayload.rotationIntervalSeconds}s`
        ],
        treeItems: [
          { enKey: 'Activity Type', trKey: 'Aktivite Türü', val: botPayload.statusType },
          { enKey: 'Streaming URL', trKey: 'Yayın Linki', val: botPayload.streamingUrl || 'N/A' },
          { enKey: 'Status Mode', trKey: 'Durum Modu', val: botPayload.statusMode },
          { enKey: 'Total Rotations', trKey: 'Toplam Durum Metni', val: `${botPayload.statuses.length} items` }
        ]
      }, req).catch(() => null);

      res.json({
        success: true,
        message: 'Discord Bot presence settings updated and live stream broadcasted successfully!',
        botSettings: updated
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Discord Bot Voice Channel API (Connect, Disconnect & Configure)
  router.post('/api/bot/voice', async (req, res) => {
    try {
      const {
        enabled = false,
        guildId = '',
        channelId = '',
        selfDeaf = true,
        selfMute = true,
        action = 'SAVE' // 'SAVE', 'CONNECT', 'DISCONNECT'
      } = req.body;

      const voiceConfig = {
        enabled: action === 'DISCONNECT' ? false : Boolean(enabled),
        guildId: String(guildId || '').trim(),
        channelId: String(channelId || '').trim(),
        selfDeaf: Boolean(selfDeaf),
        selfMute: Boolean(selfMute)
      };

      const updated = await DatabaseService.updateBotSettings({ voiceChannel: voiceConfig });
      const DiscordBotService = (await import('../discord-bot/index.js')).default;

      let voiceResult = null;
      if (voiceConfig.enabled) {
        voiceResult = await DiscordBotService.connectToVoiceChannel();
      } else {
        voiceResult = DiscordBotService.disconnectVoiceChannel();
      }

      const devName = req.session.user?.globalName || req.session.user?.username || 'Developer';
      // Dispatch to vweb-bot-voice
      DiscordBotService.sendLog('botVoice', {
        enTitle: `24/7 Voice Channel State: ${voiceConfig.enabled ? 'CONNECTED' : 'DISCONNECTED'}`,
        trTitle: `7/24 Ses Kanalı Durumu: ${voiceConfig.enabled ? 'BAĞLANDI' : 'AYRILDI'}`,
        enDesc: voiceConfig.enabled
          ? `Bot connected to voice channel #${voiceResult?.channelName || voiceConfig.channelId} in guild ${voiceResult?.guildName || voiceConfig.guildId}.`
          : `Bot disconnected from voice channel upon request by ${devName}.`,
        trDesc: voiceConfig.enabled
          ? `Bot ${voiceResult?.guildName || voiceConfig.guildId} sunucusundaki #${voiceResult?.channelName || voiceConfig.channelId} ses kanalına başarıyla bağlandı.`
          : `Bot ${devName} isteği üzerine ses kanalından ayrıldı.`,
        emojiKey: voiceConfig.enabled ? 'yes' : 'no',
        actor: devName,
        ansiLines: [
          voiceConfig.enabled ? `\u001b[1;32m[VOICE CONNECTED]\u001b[0m 24/7 Engine Active` : `\u001b[1;33m[VOICE DISCONNECTED]\u001b[0m Offline`,
          `\u001b[0;36m[TARGET CHANNEL]\u001b[0m #${voiceResult?.channelName || voiceConfig.channelId || 'N/A'}`,
          `\u001b[0;35m[GUILD ID]\u001b[0m ${voiceConfig.guildId || 'N/A'}`
        ],
        treeItems: [
          { enKey: 'Voice Channel', trKey: 'Ses Kanalı', val: voiceResult?.channelName || voiceConfig.channelId || 'N/A' },
          { enKey: 'Server Name', trKey: 'Sunucu Adı', val: voiceResult?.guildName || voiceConfig.guildId || 'N/A' },
          { enKey: 'Self Mute / Deaf', trKey: 'Sağırlaştır / Sustur', val: `Mute: ${voiceConfig.selfMute}, Deaf: ${voiceConfig.selfDeaf}` }
        ]
      }, req).catch(() => null);

      res.json({
        success: true,
        message: voiceConfig.enabled
          ? (voiceResult.connected ? `Bot successfully connected to voice channel (#${voiceResult.channelName || voiceConfig.channelId}).` : 'Voice settings saved. Bot will connect when channel is available.')
          : 'Voice channel connection disconnected/disabled.',
        voiceSettings: updated.voiceChannel,
        voiceStatus: DiscordBotService.getVoiceStatus(),
        details: voiceResult
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Live Telemetry Data API (with multi-dimensional filtering & sorting)
  router.get('/api/telemetry/data', (req, res) => {
    try {
      const data = TelemetryService.getTelemetryData(req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Test TruckersMP API Endpoint (Interactive Sandbox)
  router.post('/api/truckersmp/test', async (req, res) => {
    const { endpoint, id } = req.body;
    try {
      let result = null;
      switch (endpoint) {
        case 'player':
          result = await TruckersMPService.getPlayer(id);
          break;
        case 'bans':
          result = await TruckersMPService.getBans(id);
          break;
        case 'servers':
          result = await TruckersMPService.getServers();
          break;
        case 'game_time':
          result = await TruckersMPService.getGameTime();
          break;
        case 'events':
          result = await TruckersMPService.getEvents();
          break;
        case 'event_detail':
          result = await TruckersMPService.getEvent(id);
          break;
        case 'vtc':
          result = await TruckersMPService.getVTC(id);
          break;
        case 'vtc_members':
          result = await TruckersMPService.getVTCMembers(id);
          break;
        case 'vtc_events':
          result = await TruckersMPService.getVTCEvents(id);
          break;
        case 'version':
          result = await TruckersMPService.getVersion();
          break;
        case 'rules':
          result = await TruckersMPService.getRules();
          break;
        default:
          return res.status(400).json({ success: false, error: 'Unknown API endpoint specified.' });
      }

      // Dispatch to vweb-lookup
      const devName = req.session.user?.globalName || req.session.user?.username || 'Developer';
      import('../discord-bot/index.js').then(({ DiscordBotService }) => {
        DiscordBotService.sendLog('lookup', {
          enTitle: `Developer API Sandbox Query: /${endpoint}`,
          trTitle: `Geliştirici API Test Sorgusu: /${endpoint}`,
          enDesc: `Interactive query executed against TruckersMP Web API v2.`,
          trDesc: `TruckersMP Web API v2 üzerinde etkileşimli test sorgusu çalıştırıldı.`,
          emojiKey: result?.error ? 'no' : 'yes',
          actor: devName,
          ansiLines: [
            result?.error ? `\u001b[1;31m[API TEST FAILED]\u001b[0m` : `\u001b[1;34m[API TEST SUCCESS]\u001b[0m`,
            `\u001b[0;36m[ENDPOINT]\u001b[0m /${endpoint} ${id ? `(ID: ${id})` : ''}`,
            `\u001b[0;35m[DEVELOPER]\u001b[0m ${devName}`
          ]
        }, req).catch(() => null);
      }).catch(() => null);

      res.json({
        success: !result.error,
        endpoint,
        targetId: id || null,
        data: result
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Microservice Action: Ping / Re-check
  router.post('/api/microservices/ping', async (req, res) => {
    const { service } = req.body;
    try {
      if (service === 'truckersmp') {
        const pingRes = await TelemetryService.pingTruckersMP();
        return res.json({ success: true, ping: pingRes });
      }
      const status = await TelemetryService.getMicroservicesStatus();
      res.json({ success: true, status });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Microservice Action: Flush Cache
  router.post('/api/microservices/flush-cache', (req, res) => {
    try {
      const devName = req.session.user?.globalName || req.session.user?.username || 'Developer';
      const tmpFlush = TruckersMPService.flushCache();

      // Dispatch to vweb-cache
      import('../discord-bot/index.js').then(({ DiscordBotService }) => {
        DiscordBotService.sendLog('cache', {
          enTitle: `In-Memory API Cache Flushed by ${devName}`,
          trTitle: `Bellek İçi API Önbelleği Temizlendi (${devName})`,
          enDesc: `All cached TruckersMP API requests and temporary entries cleared.`,
          trDesc: `Tüm önbelleğe alınmış TruckersMP API yanıtları ve geçici girdiler temizlendi.`,
          emojiKey: 'yes',
          actor: devName,
          ansiLines: [
            `\u001b[1;33m[CACHE FLUSHED]\u001b[0m In-Memory Storage Reset`,
            `\u001b[0;36m[CLEARED ENTRIES]\u001b[0m ${tmpFlush.clearedEntries} Cached Items`,
            `\u001b[0;35m[DEVELOPER]\u001b[0m ${devName}`
          ]
        }, req).catch(() => null);
      }).catch(() => null);

      res.json({ success: true, message: 'TruckersMP & System In-Memory caches flushed successfully.', details: tmpFlush });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Telemetry Action: Clear Error Logs
  router.delete('/api/telemetry/logs', (req, res) => {
    try {
      const devName = req.session.user?.globalName || req.session.user?.username || 'Developer';
      const result = TelemetryService.clearErrorLogs();

      // Dispatch to vweb-cache
      import('../discord-bot/index.js').then(({ DiscordBotService }) => {
        DiscordBotService.sendLog('cache', {
          enTitle: `Telemetry Error Logs Cleared by ${devName}`,
          trTitle: `Telemetri Hata Günlükleri Sıfırlandı (${devName})`,
          enDesc: `System error buffer has been purged.`,
          trDesc: `Sistem hata tamponu tamamen temizlendi.`,
          emojiKey: 'yes',
          actor: devName,
          ansiLines: [
            `\u001b[1;33m[LOGS PURGED]\u001b[0m Error Telemetry Cleared`,
            `\u001b[0;35m[DEVELOPER]\u001b[0m ${devName}`
          ]
        }, req).catch(() => null);
      }).catch(() => null);

      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
