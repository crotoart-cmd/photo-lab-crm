const crypto = require('node:crypto');
const SecurityEvent = require('../models/SecurityEvent');

const events = new Map([
  ['POST /login', 'login'], ['POST /mfa/login', 'mfa_login'], ['POST /mfa/setup', 'mfa_setup'],
  ['POST /mfa/enable', 'mfa_enable'], ['POST /mfa/disable', 'mfa_disable'],
  ['POST /mfa/recovery-codes', 'mfa_recovery'], ['PATCH /profile', 'profile'], ['POST /logout', 'logout'],
]);
const pending = new Set();

function authAudit(req, res, next) {
  const event = /^\/sessions\/[^/]+\/?$/.test(req.path) && req.method === 'DELETE' ? 'session_revoke' : events.get(`${req.method} ${req.path}`);
  if (!event) return next();
  res.once('finish', () => {
    if (!process.env.JWT_SECRET) return;
    const ipHash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`audit-ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`).digest('hex');
    const write = SecurityEvent.create({ event, outcome: res.statusCode >= 400 ? 'failure' : req.mfaChallengeIssued ? 'challenge' : 'success',
      userId: req.auditUserId || req.userId || null, ipHash, expiresAt: new Date(Date.now() + 90 * 86400000) })
      .catch(() => console.warn('Security event could not be recorded')).finally(() => pending.delete(write));
    pending.add(write);
  });
  next();
}

module.exports = { authAudit, flushAudit: () => Promise.all([...pending]) };
