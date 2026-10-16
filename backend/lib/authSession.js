const jwt = require('jsonwebtoken');
const { setSessionCookie, wantsBearerToken } = require('./sessionCookie');

function issueSession(req, res, user) {
  const token = jwt.sign({ userId: user._id, sv: user.sessionVersion || 0 }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
  setSessionCookie(res, token);
  const mobile = wantsBearerToken(req) || String(req.headers.authorization || '').startsWith('Bearer ');
  return mobile ? { token } : {};
}

module.exports = { issueSession };
