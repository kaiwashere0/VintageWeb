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

  // ==========================================
  // Developer REST API Endpoints (AJAX & Charts)
  // ==========================================

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
      const tmpFlush = TruckersMPService.flushCache();
      res.json({ success: true, message: 'TruckersMP & System In-Memory caches flushed successfully.', details: tmpFlush });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Telemetry Action: Clear Error Logs
  router.delete('/api/telemetry/logs', (req, res) => {
    try {
      const result = TelemetryService.clearErrorLogs();
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
