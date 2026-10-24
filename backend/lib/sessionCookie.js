const SESSION_COOKIE = 'hdtlabx_sid';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function cookieMaxAgeMs() {
  const raw = String(process.env.JWT_EXPIRE || '7d').trim();
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 7 * 86400000;
  if (raw.endsWith('d')) return n * 86400000;
  if (raw.endsWith('h')) return n * 3600000;
  if (raw.endsWith('m')) return n * 60000;
  return 7 * 86400000;
}

function readCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx < 1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch (_err) {
      out[key] = value;
    }
  }
  return out;
}

function readSessionToken(req) {
  const header = String(req.headers.authorization || '');
  if (header.startsWith('Bearer ')) {
    const bearer = header.slice(7).trim();
    if (bearer) return bearer;
  }
  return readCookies(req.headers.cookie)[SESSION_COOKIE] || '';
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction() && process.env.DESKTOP_LOCAL !== 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: cookieMaxAgeMs(),
  };
}

function setSessionCookie(res, token, options = {}) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), ...options });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction() && process.env.DESKTOP_LOCAL !== 'true',
    sameSite: 'lax',
    path: '/',
  });
}

function wantsBearerToken(req) {
  const client = String(req.body?.client || req.headers['x-client'] || '').toLowerCase();
  return client === 'mobile' || client === 'capacitor';
}

module.exports = {
  SESSION_COOKIE,
  readCookies,
  readSessionToken,
  setSessionCookie,
  clearSessionCookie,
  wantsBearerToken,
  cookieMaxAgeMs,
};
