import express from 'express';
import DatabaseService, { Application, Event, Member, Gallery, User, Settings } from '../database/index.js';
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
    title: 'Yetkisiz Erişim — Vintage Club',
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
      const [applicationsCount, eventsCount, membersCount, usersCount, settings] = await Promise.all([
        Application.countDocuments(),
        Event.countDocuments(),
        Member.countDocuments(),
        User.countDocuments(),
        DatabaseService.getSettings()
      ]);

      const recentApplications = await Application.find().sort({ createdAt: -1 }).limit(5).lean();
      const recentUsers = await User.find().sort({ lastLogin: -1 }).limit(6).lean();

      res.render('admin/dashboard', {
        title: 'Yetkili Paneli — Vintage Club',
        currentPath: '/admin/dashboard',
        user: req.session.user,
        stats: {
          applicationsCount,
          eventsCount,
          membersCount,
          usersCount
        },
        settings,
        recentApplications,
        recentUsers
      });
    } catch (err) {
      console.error('[AdminRouter] Dashboard error:', err);
      res.status(500).send('Yetkili paneli yüklenirken bir hata oluştu.');
    }
  });

  // 2. Applications (Placeholder / Entry)
  router.get('/applications', async (req, res) => {
    const applications = await DatabaseService.getApplications();
    res.render('admin/dashboard', {
      title: 'Başvurular — Yetkili Paneli',
      currentPath: '/admin/applications',
      user: req.session.user,
      stats: {
        applicationsCount: applications.length,
        eventsCount: await Event.countDocuments(),
        membersCount: await Member.countDocuments(),
        usersCount: await User.countDocuments()
      },
      settings: await DatabaseService.getSettings(),
      recentApplications: applications,
      recentUsers: []
    });
  });

  return router;
}

export default createAdminRouter;
