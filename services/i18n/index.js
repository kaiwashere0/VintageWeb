import geoip from 'geoip-lite';
import en from './locales/en.js';
import tr from './locales/tr.js';
import de from './locales/de.js';

export const LOCALES = {
  en,
  tr,
  de
};

export const DEFAULT_LANGUAGE = 'en';

export const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧', label: 'EN' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', label: 'DE' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', label: 'TR' }
];

/**
 * Get nested translation value by dot notation key
 */
export function translate(lang, key, fallback = '') {
  const dictionary = LOCALES[lang] || LOCALES[DEFAULT_LANGUAGE];
  const keys = key.split('.');
  let result = dictionary;

  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = result[k];
    } else {
      // Fallback to English if missing in chosen language
      let enResult = LOCALES[DEFAULT_LANGUAGE];
      for (const ek of keys) {
        if (enResult && typeof enResult === 'object' && ek in enResult) {
          enResult = enResult[ek];
        } else {
          return fallback || key;
        }
      }
      return typeof enResult === 'string' ? enResult : (fallback || key);
    }
  }

  return typeof result === 'string' ? result : (fallback || key);
}

/**
 * Detect language from client IP address
 */
export function detectLanguageFromIp(ip) {
  if (!ip) return null;

  // Clean IP (handle localhost IPv6 and port suffixes)
  let cleanIp = ip.split(',')[0].trim();
  if (cleanIp === '::1' || cleanIp === '127.0.0.1' || cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.')) {
    return null; // Local development
  }

  try {
    const geo = geoip.lookup(cleanIp);
    if (geo && geo.country) {
      const country = geo.country.toUpperCase();
      if (country === 'TR') {
        return 'tr';
      }
      if (['DE', 'AT', 'CH'].includes(country)) {
        return 'de';
      }
      // For any other country, default to English
      return 'en';
    }
  } catch (err) {
    console.warn('[i18n] IP lookup warning:', err.message);
  }

  return null;
}

/**
 * Detect language from Accept-Language HTTP header
 */
export function detectLanguageFromHeader(header) {
  if (!header) return null;
  const langHeader = header.toLowerCase();

  if (langHeader.startsWith('tr') || langHeader.includes(',tr')) {
    return 'tr';
  }
  if (langHeader.startsWith('de') || langHeader.includes(',de')) {
    return 'de';
  }
  if (langHeader.startsWith('en') || langHeader.includes(',en')) {
    return 'en';
  }
  return null;
}

/**
 * Express Middleware for Internationalization (i18n)
 */
export function i18nMiddleware(req, res, next) {
  let selectedLang = null;

  // 1. Query parameter override (?lang=tr)
  if (req.query.lang && LOCALES[req.query.lang.toLowerCase()]) {
    selectedLang = req.query.lang.toLowerCase();
    res.cookie('vintage_lang', selectedLang, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false,
      sameSite: 'lax'
    });
  }

  // 2. Cookie preference
  if (!selectedLang && req.cookies?.vintage_lang && LOCALES[req.cookies.vintage_lang.toLowerCase()]) {
    selectedLang = req.cookies.vintage_lang.toLowerCase();
  }

  // 3. IP Geolocation auto-detection
  if (!selectedLang) {
    const clientIp = req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.socket.remoteAddress ||
      req.ip || '';
    
    const detectedFromIp = detectLanguageFromIp(clientIp);
    if (detectedFromIp && LOCALES[detectedFromIp]) {
      selectedLang = detectedFromIp;
      // Save detected language in cookie for consistency
      res.cookie('vintage_lang', selectedLang, {
        maxAge: 365 * 24 * 60 * 60 * 1000,
        httpOnly: false,
        sameSite: 'lax'
      });
    }
  }

  // 4. Accept-Language header detection
  if (!selectedLang) {
    const detectedFromHeader = detectLanguageFromHeader(req.headers['accept-language']);
    if (detectedFromHeader && LOCALES[detectedFromHeader]) {
      selectedLang = detectedFromHeader;
    }
  }

  // 5. Final fallback: English
  if (!selectedLang || !LOCALES[selectedLang]) {
    selectedLang = DEFAULT_LANGUAGE;
  }

  // Expose to templates and request
  req.currentLang = selectedLang;
  res.locals.currentLang = selectedLang;
  res.locals.currentLangObj = AVAILABLE_LANGUAGES.find(l => l.code === selectedLang) || AVAILABLE_LANGUAGES[0];
  res.locals.availableLanguages = AVAILABLE_LANGUAGES;
  res.locals.t = (key, fallback = '') => translate(selectedLang, key, fallback);
  res.locals.locales = LOCALES[selectedLang];

  next();
}

export default {
  LOCALES,
  DEFAULT_LANGUAGE,
  AVAILABLE_LANGUAGES,
  translate,
  detectLanguageFromIp,
  detectLanguageFromHeader,
  i18nMiddleware
};
