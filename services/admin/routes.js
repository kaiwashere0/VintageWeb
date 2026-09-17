import express from 'express';
import DatabaseService, { Application, Event, Member, Gallery, User, Settings, Subscriber } from '../database/index.js';
import { isSuperAdmin } from '../auth/index.js';

export function requireAdmin(req, res, next) {
  const user = req.session?.user;

  if (!user) {
    // If user is not logged in, prompt Discord OAuth login and return to admin
    return res.redirect('/auth/discord?redirect=/admin');
  }

  // Check if user is Super Admin via .env or role
  const isSuper = isSuperAdmin(user.discordId) || user.isSuperAdmin || user.role === 'Super Admin';

  if (isSuper) {
    req.session.user.isSuperAdmin = true;
    return next();
  }

  // Not authorized
  return res.status(403).render('admin/access-denied', {
    title: 'Access Denied — Vintage Club',
    currentPath: '/admin',
    user
  });
}

export function createAdminRouter() {
  const router = express.Router();

  // Protect all /admin routes with requireAdmin middleware
  router.use(requireAdmin);

  // 1. Admin Dashboard (Overview)
  router.get(['/', '/dashboard'], async (req, res) => {
    try {
      const [applicationsCount, eventsCount, membersCount, galleryCount, subscribersCount, settings] = await Promise.all([
        Application.countDocuments(),
        Event.countDocuments(),
        Member.countDocuments(),
        Gallery.countDocuments(),
        Subscriber.countDocuments(),
        DatabaseService.getSettings()
      ]);

      const recentApplications = await Application.find().sort({ createdAt: -1 }).limit(10).lean();
      const recentUsers = await User.find().sort({ lastLogin: -1 }).limit(8).lean();

      res.render('admin/dashboard', {
        title: 'Admin Portal — Vintage Club',
        currentPath: '/admin/dashboard',
        user: req.session.user,
        stats: {
          applicationsCount,
          eventsCount,
          membersCount,
          galleryCount,
          subscribersCount
        },
        settings,
        recentApplications,
        recentUsers
      });
    } catch (err) {
      console.error('[AdminRouter] Dashboard error:', err);
      res.status(500).send('An error occurred while loading the admin portal.');
    }
  });

  // 2. Applications (All Applications View)
  router.get('/applications', async (req, res) => {
    try {
      const applications = await DatabaseService.getApplications();
      const settings = await DatabaseService.getSettings();

      res.render('admin/dashboard', {
        title: 'Driver Applications — Admin Portal',
        currentPath: '/admin/applications',
        user: req.session.user,
        stats: {
          applicationsCount: applications.length,
          eventsCount: await Event.countDocuments(),
          membersCount: await Member.countDocuments(),
          galleryCount: await Gallery.countDocuments(),
          subscribersCount: await Subscriber.countDocuments()
        },
        settings,
        recentApplications: applications,
        recentUsers: []
      });
    } catch (err) {
      console.error('[AdminRouter] Applications error:', err);
      res.status(500).send('Error loading applications.');
    }
  });

  // 3. Update Application Status (Approve / Reject)
  router.post('/applications/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const { id } = req.params;
      const adminName = req.session.user?.globalName || req.session.user?.username || 'Admin';

      const updated = await DatabaseService.updateApplicationStatus(id, status, adminName);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Application not found.' });
      }
      res.json({ success: true, message: `Application ${status} successfully.`, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Delete Application
  router.delete('/applications/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await DatabaseService.deleteApplication(id);
      res.json({ success: true, message: 'Application removed successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Update Settings
  router.post('/settings', async (req, res) => {
    try {
      const updated = await DatabaseService.updateSettings(req.body);
      res.json({ success: true, message: 'Settings updated successfully.', settings: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

export default createAdminRouter;
