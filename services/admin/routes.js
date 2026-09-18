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

      // Dispatch to vweb-app-status
      import('../discord-bot/index.js').then(({ DiscordBotService }) => {
        const isApprove = status === 'approved';
        DiscordBotService.sendLog('appStatus', {
          enTitle: `Application ${status.toUpperCase()}: ${updated.fullName}`,
          trTitle: `Başvuru Durumu Güncellendi (${status.toUpperCase()}): ${updated.fullName}`,
          enDesc: `Driver application status was set to \`${status}\` by ${adminName}.`,
          trDesc: `Sürücü başvuru durumu ${adminName} tarafından \`${status}\` olarak güncellendi.`,
          emojiKey: isApprove ? 'yes' : 'no',
          actor: adminName,
          ansiLines: [
            isApprove ? `\u001b[1;32m[STATUS UPDATED]\u001b[0m APPROVED` : `\u001b[1;31m[STATUS UPDATED]\u001b[0m REJECTED`,
            `\u001b[0;36m[CANDIDATE]\u001b[0m ${updated.fullName} (@${updated.discordTag})`,
            `\u001b[0;35m[REVIEWED BY]\u001b[0m ${adminName}`,
            `\u001b[0;37m[APP ID]\u001b[0m #${updated.id}`
          ],
          treeItems: [
            { enKey: 'Application ID', trKey: 'Başvuru No', val: updated.id },
            { enKey: 'Candidate Name', trKey: 'Aday', val: updated.fullName },
            { enKey: 'New Status', trKey: 'Yeni Durum', val: status.toUpperCase() },
            { enKey: 'Admin Reviewer', trKey: 'İnceleyen Yönetici', val: adminName }
          ]
        }, req).catch(() => null);
      }).catch(() => null);

      res.json({ success: true, message: `Application ${status} successfully.`, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Delete Application
  router.delete('/applications/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const adminName = req.session.user?.globalName || req.session.user?.username || 'Admin';
      const app = await Application.findOne({ id }).lean();
      
      await DatabaseService.deleteApplication(id);

      // Dispatch to vweb-app-delete
      import('../discord-bot/index.js').then(({ DiscordBotService }) => {
        DiscordBotService.sendLog('appDelete', {
          enTitle: `Driver Application Deleted: #${id}`,
          trTitle: `Sürücü Başvurusu Silindi: #${id}`,
          enDesc: `Application record #${id} (${app?.fullName || 'Candidate'}) was deleted permanently by ${adminName}.`,
          trDesc: `#${id} numaralı başvuru kaydı (${app?.fullName || 'Aday'}) ${adminName} tarafından kalıcı olarak silindi.`,
          emojiKey: 'no',
          actor: adminName,
          ansiLines: [
            `\u001b[1;31m[RECORD DELETED]\u001b[0m Application Removed`,
            `\u001b[0;36m[TARGET APP]\u001b[0m #${id} (${app?.fullName || 'Unknown'})`,
            `\u001b[0;35m[PERFORMED BY]\u001b[0m ${adminName}`
          ],
          treeItems: [
            { enKey: 'Application ID', trKey: 'Başvuru No', val: id },
            { enKey: 'Candidate Name', trKey: 'Aday Adı', val: app?.fullName || 'N/A' },
            { enKey: 'Discord Tag', trKey: 'Discord', val: app?.discordTag || 'N/A' },
            { enKey: 'Deleted By', trKey: 'Silen Yönetici', val: adminName }
          ]
        }, req).catch(() => null);
      }).catch(() => null);

      res.json({ success: true, message: 'Application removed successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Update Settings
  router.post('/settings', async (req, res) => {
    try {
      const adminName = req.session.user?.globalName || req.session.user?.username || 'Admin';
      const updated = await DatabaseService.updateSettings(req.body);

      // Dispatch to vweb-settings
      import('../discord-bot/index.js').then(({ DiscordBotService }) => {
        DiscordBotService.sendLog('settings', {
          enTitle: `VTC Settings Updated by ${adminName}`,
          trTitle: `VTC Ayarları Güncellendi (Yönetici: ${adminName})`,
          enDesc: `General website configuration and VTC parameters have been updated.`,
          trDesc: `Genel web sitesi yapılandırması ve VTC parametreleri güncellendi.`,
          emojiKey: 'yes',
          actor: adminName,
          ansiLines: [
            `\u001b[1;32m[SETTINGS UPDATED]\u001b[0m MongoDB Sync`,
            `\u001b[0;36m[SITE MODE]\u001b[0m Mode ${updated.siteMode}`,
            `\u001b[0;33m[VTC NAME]\u001b[0m ${updated.vtcName}`,
            `\u001b[0;35m[ADMIN]\u001b[0m ${adminName}`
          ],
          treeItems: [
            { enKey: 'VTC Name', trKey: 'VTC Adı', val: updated.vtcName || 'Vintage Club' },
            { enKey: 'Motto', trKey: 'Slogan', val: updated.motto || 'N/A' },
            { enKey: 'Site Mode', trKey: 'Site Modu', val: `Mode ${updated.siteMode}` },
            { enKey: 'TruckersMP VTC ID', trKey: 'TMP VTC ID', val: updated.truckersMpVtcId || 'N/A' }
          ]
        }, req).catch(() => null);
      }).catch(() => null);

      res.json({ success: true, message: 'Settings updated successfully.', settings: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. TruckersMP Staff Tools (Driver Verification & Ban Checker)
  router.get('/truckersmp', async (req, res) => {
    try {
      const TruckersMPService = (await import('../truckersmp/index.js')).default;
      const servers = await TruckersMPService.getServers();

      res.render('admin/truckersmp', {
        title: 'TruckersMP Staff Tools — Admin Portal',
        currentPath: '/admin/truckersmp',
        user: req.session.user,
        servers: servers.response || []
      });
    } catch (err) {
      res.status(500).send('Error loading TruckersMP tools: ' + err.message);
    }
  });

  // 7. API for TruckersMP Driver Quick Search
  router.get('/api/truckersmp/search-driver', async (req, res) => {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Driver ID or SteamID64 is required.' });
    }
    try {
      const adminName = req.session?.user?.globalName || req.session?.user?.username || 'Staff Member';
      const TruckersMPService = (await import('../truckersmp/index.js')).default;
      const [player, bans] = await Promise.all([
        TruckersMPService.getPlayer(id),
        TruckersMPService.getBans(id)
      ]);

      // Dispatch to vweb-lookup
      import('../discord-bot/index.js').then(({ DiscordBotService }) => {
        const p = player.response || {};
        const b = (bans.response && Array.isArray(bans.response)) ? bans.response : [];
        const activeBans = b.filter(item => item.active);
        
        DiscordBotService.sendLog('lookup', {
          enTitle: `Staff Driver Lookup: ${p.name || id}`,
          trTitle: `Yönetici Sürücü Sorgusu: ${p.name || id}`,
          enDesc: `Staff member queried TruckersMP profile and ban history.`,
          trDesc: `Yönetici TruckersMP profilini ve ban geçmişini sorguladı.`,
          emojiKey: activeBans.length > 0 ? 'no' : 'yes',
          actor: adminName,
          ansiLines: [
            `\u001b[1;34m[LOOKUP QUERY]\u001b[0m TruckersMP Web API v2`,
            `\u001b[0;36m[TARGET]\u001b[0m ${p.name || 'Unknown'} (ID: #${id})`,
            `\u001b[0;${activeBans.length > 0 ? '31' : '32'}m[BANS]\u001b[0m ${activeBans.length} Active / ${b.length} Total`,
            `\u001b[0;35m[QUERIED BY]\u001b[0m ${adminName}`
          ],
          treeItems: [
            { enKey: 'Driver Name', trKey: 'Sürücü Adı', val: p.name || 'N/A' },
            { enKey: 'TMP ID', trKey: 'TMP ID', val: String(id) },
            { enKey: 'SteamID64', trKey: 'Steam ID', val: p.steamID64 || 'N/A' },
            { enKey: 'Active Bans', trKey: 'Aktif Ban', val: `${activeBans.length} Active` }
          ]
        }, req).catch(() => null);
      }).catch(() => null);

      res.json({
        success: !player.error,
        player: player.response || null,
        bans: bans.response || [],
        raw: { player, bans }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

export default createAdminRouter;
