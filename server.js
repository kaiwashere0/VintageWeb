import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import DatabaseService from './services/database/index.js';
import { createApiRouter } from './services/api/routes.js';
import { createAuthRouter, isSuperAdmin } from './services/auth/index.js';
import { createAdminRouter } from './services/admin/routes.js';
import DiscordBotService from './services/discord-bot/index.js';
import { i18nMiddleware, LOCALES, AVAILABLE_LANGUAGES } from './services/i18n/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7635;

// Reverse Proxy Support
app.set('trust proxy', 1);

// CORS & Security Headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// JSON, URL Encoded, Cookie & Session Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'vintage_club_secure_session_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Multi-Language (i18n) Middleware
app.use(i18nMiddleware);

// Expose currentUser and currentPath globally to all EJS templates
app.use((req, res, next) => {
  if (req.session?.user) {
    const isSuper = isSuperAdmin(req.session.user.discordId);
    if (isSuper) {
      req.session.user.isSuperAdmin = true;
      req.session.user.role = 'Super Admin';
    }
  }
  res.locals.user = req.session?.user || null;
  next();
});

// Language Switcher Route
app.get('/lang/:code', (req, res) => {
  const code = (req.params.code || '').toLowerCase();
  if (LOCALES[code]) {
    res.cookie('vintage_lang', code, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });
  }
  const referer = req.get('Referrer') || '/';
  // Avoid redirect loops
  if (referer.includes('/lang/')) {
    return res.redirect('/');
  }
  res.redirect(referer);
});

// Locales API for Frontend Scripts
app.get('/api/v1/locales/:lang?', (req, res) => {
  const lang = req.params.lang?.toLowerCase() || req.currentLang || 'en';
  const data = LOCALES[lang] || LOCALES['en'];
  res.json({
    success: true,
    lang,
    locales: data
  });
});

// Static Files (public directory - CSS, JS, Media)
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  etag: true
}));

// Microservice Routers
app.use('/auth', createAuthRouter());
app.use('/admin', createAdminRouter());
app.use('/api/v1', createApiRouter());
app.use('/api', createApiRouter()); // Backward compatibility

// EJS Template Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Clean URL Routes (EJS Render)
app.get('/', (req, res) => res.render('index', { currentPath: '/' }));
app.get('/about', (req, res) => res.render('about', { currentPath: '/about' }));
app.get('/team', (req, res) => res.render('team', { currentPath: '/team' }));
app.get('/events', (req, res) => res.render('events', { currentPath: '/events' }));
app.get('/gallery', (req, res) => res.render('gallery', { currentPath: '/gallery' }));
app.get('/apply', (req, res) => res.render('apply', { currentPath: '/apply' }));

// 404 & Fallback
app.get('*', (req, res) => {
  res.render('index', { currentPath: '/' });
});

// Server Initialization
const server = app.listen(PORT, () => {
  console.log(`\n\x1b[38;2;140;81;55m┌────────────────────────────────────────────────────────┐\x1b[0m`);
  console.log(`\x1b[38;2;140;81;55m│\x1b[0m   \x1b[1m\x1b[38;2;170;99;67m✨ VINTAGE CLUB WEB PLATFORM\x1b[0m                        \x1b[38;2;140;81;55m│\x1b[0m`);
  console.log(`\x1b[38;2;140;81;55m├────────────────────────────────────────────────────────┤\x1b[0m`);
  console.log(`\x1b[38;2;140;81;55m│\x1b[0m   \x1b[32m🚀 Sunucu\x1b[0m     : \x1b[1mhttp://localhost:${PORT}\x1b[0m                 \x1b[38;2;140;81;55m│\x1b[0m`);
  console.log(`\x1b[38;2;140;81;55m│\x1b[0m   \x1b[34m📦 Modüller\x1b[0m   : API (v1), Auth (OAuth), i18n (EN/TR/DE) \x1b[38;2;140;81;55m│\x1b[0m`);
  console.log(`\x1b[38;2;140;81;55m│\x1b[0m   \x1b[35m👑 Geliştirici\x1b[0m: kai7m (Vintage Club 2026)             \x1b[38;2;140;81;55m│\x1b[0m`);
  console.log(`\x1b[38;2;140;81;55m└────────────────────────────────────────────────────────┘\x1b[0m\n`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('Closing server gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

export default app;
export { app, server, DatabaseService, DiscordBotService };

