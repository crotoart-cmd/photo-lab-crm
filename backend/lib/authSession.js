const jwt = require('jsonwebtoken');
const { setSessionCookie, wantsBearerToken } = require('./sessionCookie');
const sessions = require('./adminSessions');

async function issueSession(req, res, user, { mfaVerified = req.mfaVerified === true } = {}) {
  if (user.mfaEnabled && !mfaVerified) throw new Error('Second factor required');
  const mobile = !req.adminSession && (wantsBearerToken(req) || String(req.headers.authorization || '').startsWith('Bearer '));
  const web = mobile ? null : await sessions.create(req, user);
  const token = jwt.sign({ userId: user._id, sv: user.sessionVersion || 0, mfa: mfaVerified,
    kind: mobile ? 'native' : 'web', ...(web ? { sid: web.id } : {}) }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: mobile ? process.env.JWT_EXPIRE || '7d' : sessions.MAX_MS / 1000,
  });
  if (web) {
    setSessionCookie(res, token, { maxAge: sessions.MAX_MS });
    sessions.deadlines(res, web.record);
  } else setSessionCookie(res, token);
  return mobile ? { token } : {};
}

module.exports = { issueSession };
