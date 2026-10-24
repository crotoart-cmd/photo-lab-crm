const crypto = require('node:crypto');
const { readSessionToken, readCookies, SESSION_COOKIE } = require('../lib/sessionCookie');
const { isAllowedOrigin } = require('./security');

function csrfToken(req) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`hdtlabx:csrf:v1:${readSessionToken(req)}`).digest('base64url');
}

function sameOrigin(req) {
  if (!req.headers.origin) return req.headers['sec-fetch-site'] !== 'cross-site';
  try {
    const origin = new URL(req.headers.origin);
    const local = process.env.NODE_ENV !== 'production' || process.env.DESKTOP_LOCAL === 'true';
    return (origin.host === req.headers.host && (local || origin.protocol === 'https:') && /^https?:$/.test(origin.protocol)) ||
      (local && isAllowedOrigin(req.headers.origin));
  } catch { return false; }
}

function csrfProtection(req, res, next) {
  if (/^Bearer \S+/.test(String(req.headers.authorization || ''))) return next();
  const login = /^\/auth\/(login|mfa\/login)\/?$/.test(req.path);
  const cookie = readCookies(req.headers.cookie)[SESSION_COOKIE];
  const nativeLogin = login && !cookie && ['capacitor://localhost', 'ionic://localhost', 'https://localhost'].includes(req.headers.origin);
  const safe = /^(GET|HEAD|OPTIONS)$/.test(req.method);
  if ((login || (cookie && (!safe || req.path === '/auth/csrf'))) && !nativeLogin && !sameOrigin(req)) return res.status(403).json({ code: 'CSRF_ORIGIN_INVALID', message: 'Nguồn yêu cầu không hợp lệ.' });
  if (!cookie || login || safe || /^\/(public|repair-public|delivery)(\/|$)/.test(req.path)) return next();
  try {
    const expected = Buffer.from(csrfToken(req));
    const supplied = Buffer.from(String(req.headers['x-csrf-token'] || '').slice(0, 100));
    if (expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied)) return next();
  } catch { /* Configuration or invalid proof must not permit a cookie mutation. */ }
  return res.status(403).json({ code: 'CSRF_TOKEN_INVALID', message: 'Phiên bảo mật đã thay đổi. Tải lại trang và thử lại.' });
}

module.exports = { csrfToken, csrfProtection, sameOrigin };
