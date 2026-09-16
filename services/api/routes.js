import express from 'express';
import DatabaseService from '../database/index.js';
import { DiscordBotService } from '../discord-bot/index.js';

export function createApiRouter() {
  const router = express.Router();

  // CORS & Format Headers
  router.use((req, res, next) => {
    res.header('Content-Type', 'application/json');
    next();
  });

  // Health Check
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Vintage Club API Microservice',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // 1. System and Site Mode Endpoints
  router.get('/system/mode', async (req, res) => {
    try {
      const settings = await DatabaseService.getSettings();
      res.json({
        success: true,
        siteMode: settings.siteMode || 3,
        modes: {
          1: "Coming Soon",
          2: "Under Construction",
          3: "Full Active VTC Portal"
        },
        settings
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/system/mode', async (req, res) => {
    try {
      const { mode } = req.body;
      const parsedMode = parseInt(mode, 10);
      if (![1, 2, 3].includes(parsedMode)) {
        return res.status(400).json({ success: false, message: "Invalid mode! Select 1, 2, or 3." });
      }
      const newMode = await DatabaseService.setSiteMode(parsedMode);
      res.json({ success: true, message: `Site mode updated to ${newMode}.`, siteMode: newMode });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. VTC İstatistikleri
  router.get('/stats', async (req, res) => {
    try {
      const settings = await DatabaseService.getSettings();
      const members = await DatabaseService.getMembers();
      const events = await DatabaseService.getEvents();

      res.json({
        success: true,
        data: {
          vtcName: settings.vtcName,
          establishedYear: settings.establishedYear,
          motto: settings.motto,
          totalMembers: members.length || settings.stats.totalMembers,
          totalConvoys: settings.stats.totalConvoys,
          totalKilometers: settings.stats.totalKilometers,
          truckersMpVtcId: settings.truckersMpVtcId,
          truckersMpUrl: settings.truckersMpUrl,
          discordInviteUrl: settings.discordInviteUrl,
          youtubeUrl: settings.youtubeUrl,
          instagramUrl: settings.instagramUrl,
          upcomingEventsCount: events.filter(e => e.status === 'upcoming').length
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Ekip / Takım Üyeleri
  router.get('/team', async (req, res) => {
    try {
      const { category } = req.query;
      let members = await DatabaseService.getMembers();
      if (category) {
        members = members.filter(m => m.category === category);
      }
      res.json({
        success: true,
        count: members.length,
        data: members
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Etkinlikler / Konvoylar
  router.get('/events', async (req, res) => {
    try {
      const events = await DatabaseService.getEvents();
      res.json({
        success: true,
        count: events.length,
        data: events
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/events/:id', async (req, res) => {
    try {
      const events = await DatabaseService.getEvents();
      const event = events.find(e => e.id === req.params.id);
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found.' });
      }
      res.json({ success: true, data: event });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Galeri
  router.get('/gallery', async (req, res) => {
    try {
      const { category } = req.query;
      let items = await DatabaseService.getGallery();
      if (category && category !== 'all') {
        items = items.filter(g => g.category === category);
      }
      res.json({
        success: true,
        count: items.length,
        data: items
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Sürücü Başvurusu (Recruitment)
  router.post('/applications', async (req, res) => {
    try {
      const { fullName, age, discordTag, truckersMpProfile, steamProfile, experienceHours, dlcList, notes } = req.body;

      if (!fullName || !discordTag || !truckersMpProfile) {
        return res.status(400).json({
          success: false,
          message: 'Please fill in all required fields (Full Name, Discord Username, TruckersMP Profile).'
        });
      }

      const application = await DatabaseService.createApplication({
        fullName: fullName.trim(),
        age: parseInt(age, 10) || null,
        discordTag: discordTag.trim(),
        truckersMpProfile: truckersMpProfile.trim(),
        steamProfile: (steamProfile || '').trim(),
        experienceHours: (experienceHours || '').trim(),
        dlcList: Array.isArray(dlcList) ? dlcList : (dlcList ? [dlcList] : []),
        notes: (notes || '').trim(),
        ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '').split(',')[0].trim()
      });

      // Discord Bot / Webhook Notification
      try {
        await DiscordBotService.notifyNewApplication(application);
      } catch (botErr) {
        console.warn('[DiscordBotService] Notification warning:', botErr.message);
      }

      res.status(201).json({
        success: true,
        message: 'Your application has been received by Vintage Club leadership. We will reach out to you on Discord shortly.',
        data: { id: application.id }
      });
    } catch (err) {
      console.error('Application submission error:', err);
      res.status(500).json({ success: false, message: 'An error occurred while saving your application.' });
    }
  });

  // 7. Newsletter / Email Subscription
  router.post('/subscribe', async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
      }

      const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '').split(',')[0].trim();
      const result = await DatabaseService.addSubscriber(email, clientIp);

      if (result.alreadySubscribed) {
        return res.status(200).json({
          success: true,
          message: 'This email is already registered on our newsletter list.',
          alreadySubscribed: true
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Thank you! Your email has been subscribed successfully.',
        subscriber: result.subscriber
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
  });

  router.get('/subscribers', async (req, res) => {
    try {
      const subscribers = await DatabaseService.getSubscribers();
      res.json({
        success: true,
        total: subscribers.length,
        subscribers: subscribers.map(s => ({ email: s.email, createdAt: s.createdAt }))
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Could not fetch subscribers.' });
    }
  });

  return router;
}

export default createApiRouter;
