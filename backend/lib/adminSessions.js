const crypto = require('node:crypto');
const AdminSession = require('../models/AdminSession');

const IDLE_MS = 30 * 60000;
const MAX_MS = 8 * 3600000;
const hash = (id) => crypto.createHash('sha256').update(id).digest('hex');

function device(req) {
  const ua = String(req.headers['user-agent'] || '').slice(0, 1024);
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const platform = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  return { browser, platform };
}

async function create(req, user) {
  const id = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const record = await AdminSession.create({ sessionIdHash: hash(id), userId: user._id, sessionVersion: user.sessionVersion || 0,
    ...device(req), createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + MAX_MS) });
  return { id, record };
}

function activeFilter(userId, version, now = new Date()) {
  return { userId, sessionVersion: version, revokedAt: null, expiresAt: { $gt: now }, lastSeenAt: { $gt: new Date(now.getTime() - IDLE_MS) } };
}

async function verify(req, decoded) {
  if (typeof decoded.sid !== 'string' || !/^[\w-]{43}$/.test(decoded.sid) || decoded.kind !== 'web') return null;
  const now = new Date();
  const filter = { ...activeFilter(decoded.userId, decoded.sv, now), sessionIdHash: hash(decoded.sid) };
  let record = await AdminSession.findOne(filter);
  // Only explicit foreground activity may extend idle time, never background polling.
  if (record && req.headers['x-session-activity'] === '1' && now - record.lastSeenAt >= 60000) {
    record = await AdminSession.findOneAndUpdate(filter, { $set: { lastSeenAt: now } }, { new: true });
  }
  return record;
}

function deadlines(res, record) {
  res.setHeader('X-Session-Expires-At', record.expiresAt.toISOString());
  res.setHeader('X-Session-Idle-Expires-At', new Date(Math.min(record.expiresAt.getTime(), record.lastSeenAt.getTime() + IDLE_MS)).toISOString());
}

module.exports = { IDLE_MS, MAX_MS, create, verify, activeFilter, deadlines };
