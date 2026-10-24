const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { readSessionToken, clearSessionCookie, setSessionCookie } = require('../lib/sessionCookie');
const sessions = require('../lib/adminSessions');
const { sameOrigin } = require('./csrf');

const verifyToken = async (req, res, next) => {
  const token = readSessionToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Cần đăng nhập' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'Máy chủ chưa cấu hình xác thực' });
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const user = await User.findById(decoded.userId).select('role status sessionVersion mfaEnabled');
    if (!user || user.status !== 'active' || !Number.isInteger(decoded.sv) || decoded.sv !== (user.sessionVersion || 0) || (user.mfaEnabled && decoded.mfa !== true)) {
      return res.status(401).json({ message: 'Cần đăng nhập' });
    }
    req.userId = String(user._id);
    req.userRole = user.role;
    req.sessionVersion = user.sessionVersion || 0;
    req.mfaVerified = decoded.mfa === true;
    const header = String(req.headers.authorization || '');
    if (decoded.kind === 'web' && !header.startsWith('Bearer ') && !sameOrigin(req)) {
      return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' });
    }
    if (decoded.kind === 'web' || (!header.startsWith('Bearer ') && decoded.kind !== 'native')) {
      const session = await sessions.verify(req, decoded);
      if (!session) {
        clearSessionCookie(res);
        return res.status(401).json({ message: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' });
      }
      req.adminSession = session;
      sessions.deadlines(res, session);
    } else if (!header.startsWith('Bearer ') && req.headers['x-client'] === 'web') {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Vui lòng đăng nhập lại bằng phiên admin web.' });
    } else if (header.startsWith('Bearer ')) {
      // Preserve native WebView media access without extending the bearer token's expiry.
      const nativeCookie = decoded.kind === 'native' ? token : jwt.sign({ ...decoded, kind: 'native' }, secret, { algorithm: 'HS256' });
      setSessionCookie(res, nativeCookie);
    }
    next();
  } catch (_error) {
    if (!String(req.headers.authorization || '').startsWith('Bearer ')) clearSessionCookie(res);
    res.status(401).json({ message: 'Cần đăng nhập' });
  }
};

module.exports = { verifyToken };
