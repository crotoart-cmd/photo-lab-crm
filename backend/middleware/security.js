const { PRODUCTION_SITE_HOST, PRODUCTION_ADMIN_HOST } = require('../config/hosts');

const isProduction = () => process.env.NODE_ENV === 'production';

const STATIC_ORIGINS = [
  `https://${PRODUCTION_SITE_HOST}`,
  `https://www.${PRODUCTION_SITE_HOST}`,
  `https://${PRODUCTION_ADMIN_HOST}`,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
  'capacitor://localhost',
  'ionic://localhost',
  'https://localhost',
];

function extraOriginsFromEnv() {
  return String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function allowedOriginList() {
  const fromFrontend = String(process.env.FRONTEND_URL || '')
    .trim()
    .replace(/\/$/, '');
  const fromAdmin = String(process.env.ADMIN_URL || '')
    .trim()
    .replace(/\/$/, '');
  return [...STATIC_ORIGINS, fromFrontend, fromAdmin, ...extraOriginsFromEnv()].filter(Boolean);
}

function isLocalDevOrigin(origin) {
  if (isProduction()) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOriginList().includes(origin)) return true;
  return isLocalDevOrigin(origin);
}

function corsOrigin(origin, callback) {
  if (isAllowedOrigin(origin)) return callback(null, true);
  return callback(null, false);
}

function cspConnectSrc() {
  const extras = allowedOriginList().filter((o) => /^https?:\/\//i.test(o));
  return ["'self'", ...new Set(extras)].join(' ');
}

function buildCsp() {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${cspConnectSrc()}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

function applySecurityHeaders(req, res, next) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()'
  );
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Content-Security-Policy', buildCsp());
  if (isProduction()) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  }
  if (typeof next === 'function') next();
}

function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  if (typeof next === 'function') next();
}

function sanitizeRedirectPath(raw) {
  const path = String(raw || '/');
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/';
  return path;
}

function assertSecurityEnv() {
  const secret = String(process.env.JWT_SECRET || '');
  const missing = [];
  if (!secret) missing.push('JWT_SECRET');
  if (isProduction() && secret && (secret.length < 32 || /replace_with|change_me|desktop_local_secret/i.test(secret) || /^(.)\1+$/.test(secret))) missing.push('JWT_SECRET(strength)');
  if (isProduction() && !process.env.OWNER_PASSWORD) missing.push('OWNER_PASSWORD');
  if (isProduction() && !process.env.MONGODB_URI && process.env.USE_MEMORY_DB !== 'true') {
    missing.push('MONGODB_URI');
  }
  if (isProduction() && process.env.OWNER_PASSWORD && (process.env.OWNER_PASSWORD.length < 12 || /replace_with|change_me/i.test(process.env.OWNER_PASSWORD))) {
    console.warn('⚠️  OWNER_PASSWORD yếu — đặt mật khẩu owner ≥ 12 ký tự trên Hostinger.');
  }
  if (process.env.DESKTOP_LOCAL === 'true' && process.env.BIND_HOST !== '127.0.0.1') {
    missing.push('BIND_HOST(desktop)');
  }
  if (missing.length) {
    const msg = `Thiếu cấu hình bảo mật: ${missing.join(', ')}`;
    if (isProduction()) {
      console.error(`❌ ${msg}`);
    } else {
      console.warn(`⚠️  ${msg} — chỉ chấp nhận khi development`);
    }
    if (isProduction() || process.env.DESKTOP_LOCAL === 'true') {
      throw new Error(msg);
    }
  }
}

function trustedProxySetting() {
  const value = String(process.env.TRUST_PROXY || '').trim();
  if (value === 'false') return false;
  if (value === 'true' || /^\d+$/.test(value)) {
    throw new Error('TRUST_PROXY cần địa chỉ hoặc subnet proxy tin cậy');
  }
  if (!value) {
    const { isSharedProxyPeer } = require('./rateLimit');
    return (ip) => isSharedProxyPeer(ip);
  }
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function sanitizeApiErrors(req, res, next) {
  const json = res.json;
  res.json = function safeJson(body) {
    if (this.statusCode >= 500) return json.call(this, { message: 'Không xử lý được yêu cầu' });
    if (this.statusCode >= 400 && body?.message && Object.hasOwn(body, 'error')) {
      const { error: _internalError, ...publicBody } = body;
      return json.call(this, publicBody);
    }
    return json.call(this, body);
  };
  next();
}

function allowDemoSeed() {
  return (
    process.env.USE_MEMORY_DB === 'true' ||
    process.env.AUTO_SEED === 'true' ||
    process.env.SEED_DEMO_DATA === 'true' ||
    !isProduction()
  );
}

module.exports = {
  isProduction,
  isAllowedOrigin,
  corsOrigin,
  applySecurityHeaders,
  noStore,
  sanitizeRedirectPath,
  assertSecurityEnv,
  allowDemoSeed,
  buildCsp,
  allowedOriginList,
  trustedProxySetting,
  sanitizeApiErrors,
};
