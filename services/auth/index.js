import express from 'express';
import DatabaseService from '../database/index.js';
import crypto from 'crypto';

export function isSuperAdmin(discordId) {
  if (!discordId) return false;
  const superIds = (process.env.SUPER_ADMIN_IDS || process.env.SUPER_ADMIN_ID || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return superIds.includes(String(discordId).trim());
}

export function isDeveloper(discordId) {
  if (!discordId) return false;
  const devIds = (process.env.DEVELOPER_IDS || process.env.DEVELOPER_ID || process.env.SUPER_ADMIN_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return devIds.includes(String(discordId).trim());
}

export function createAuthRouter() {
  const router = express.Router();

  const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
  const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:7635/auth/discord/callback';

  // 1. Initiate Real Discord OAuth2 Flow
  router.get('/discord', (req, res) => {
    // Save target redirect URL (e.g. /admin)
    if (req.query.redirect) {
      req.session.returnTo = req.query.redirect;
    }

    // Generate secure state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;

    if (CLIENT_ID && CLIENT_SECRET) {
      const scope = encodeURIComponent('identify email guilds');
      const redirectUri = encodeURIComponent(REDIRECT_URI);
      const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&prompt=consent`;
      return res.redirect(discordAuthUrl);
    }

    // Interactive Demo Login Fallback (Only active when .env credentials are not yet configured)
    const mockId = req.query.mockId || '1243266940873740381';
    const isSuper = isSuperAdmin(mockId);
    const isDev = isDeveloper(mockId);
    const demoProfile = {
      id: mockId,
      username: req.query.mockUsername || 'VintageDev',
      global_name: req.query.mockName || 'Vintage Developer',
      discriminator: '0',
      avatar: '',
      email: 'dev@vintageclub.com'
    };

    DatabaseService.findOrCreateUser(demoProfile, isSuper)
      .then(user => {
        const userObj = user.toObject ? user.toObject() : { ...user };
        userObj.isSuperAdmin = isSuper;
        userObj.isDeveloper = isDev;
        req.session.user = userObj;
        req.session.save(() => {
          const dest = req.session.returnTo || '/?auth=success&provider=discord_sandbox';
          delete req.session.returnTo;
          res.redirect(dest);
        });
      })
      .catch(err => {
        console.error('[Auth] Sandbox login error:', err);
        res.redirect('/?auth=error');
      });
  });

  // 2. Discord OAuth2 Callback Handler
  router.get('/discord/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.warn(`\x1b[33m⚠\x1b[0m \x1b[1m[Discord OAuth]\x1b[0m Kullanıcı yetkiyi iptal etti: ${error_description || error}`);
      return res.redirect('/?auth=cancelled');
    }

    if (!code) {
      return res.redirect('/?auth=no_code');
    }

    // CSRF verification
    if (req.session.oauthState && state && req.session.oauthState !== state) {
      console.error('\x1b[31m✖\x1b[0m \x1b[1m[Discord OAuth]\x1b[0m CSRF State eşleşmedi!');
      return res.redirect('/?auth=invalid_state');
    }

    try {
      // Exchange Code for Access Token with Discord API v10
      const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.access_token) {
        console.error('\x1b[31m✖\x1b[0m \x1b[1m[Discord OAuth]\x1b[0m Token değişimi başarısız:', tokenData);
        return res.redirect('/?auth=token_error');
      }

      // Fetch Authenticated User Profile
      const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      });

      const discordUser = await userResponse.json();

      if (!discordUser || !discordUser.id) {
        console.error('\x1b[31m✖\x1b[0m \x1b[1m[Discord OAuth]\x1b[0m Kullanıcı bilgileri alınamadı:', discordUser);
        return res.redirect('/?auth=user_fetch_error');
      }

      // Check Super Admin & Developer Status against .env
      const isSuper = isSuperAdmin(discordUser.id);
      const isDev = isDeveloper(discordUser.id);

      // Save / Update User in Database
      const user = await DatabaseService.findOrCreateUser(discordUser, isSuper);
      const userObj = user.toObject ? user.toObject() : { ...user };
      userObj.isSuperAdmin = isSuper;
      userObj.isDeveloper = isDev;

      // Save user in session
      req.session.user = userObj;
      req.session.oauthToken = tokenData.access_token;
      req.session.save((err) => {
        if (err) {
          console.error('\x1b[31m✖\x1b[0m \x1b[1m[Session]\x1b[0m Oturum kayıt hatası:', err);
          return res.redirect('/?auth=session_error');
        }
        console.log(`\x1b[32m✔\x1b[0m \x1b[1m[Discord Login]\x1b[0m \x1b[36m${user.globalName || user.username}\x1b[0m (@${user.username}) ${isSuper ? '\x1b[33m[SÜPER YÖNETİCİ]\x1b[0m' : ''} ${isDev ? '\x1b[35m[DEVELOPER]\x1b[0m' : ''} giriş yaptı.`);
        
        const destination = req.session.returnTo || (isDev ? '/developer' : (isSuper ? '/admin' : '/?auth=success'));
        delete req.session.returnTo;
        res.redirect(destination);
      });

    } catch (err) {
      console.error('\x1b[31m✖\x1b[0m \x1b[1m[Discord OAuth]\x1b[0m Sunucu hatası:', err.message);
      res.redirect('/?auth=server_error');
    }
  });

  // 3. Current User Endpoint
  router.get('/me', (req, res) => {
    if (req.session && req.session.user) {
      return res.json({
        authenticated: true,
        user: req.session.user
      });
    }
    return res.json({
      authenticated: false,
      user: null
    });
  });

  // 4. Logout Handler
  router.get('/logout', (req, res) => {
    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/?auth=logged_out');
      });
    } else {
      res.redirect('/');
    }
  });

  return router;
}

export default createAuthRouter;

