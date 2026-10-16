const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { readSessionToken, setSessionCookie } = require('../lib/sessionCookie');

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
    const user = await User.findById(decoded.userId).select('role status sessionVersion');
    if (!user || user.status !== 'active' || !Number.isInteger(decoded.sv) || decoded.sv !== (user.sessionVersion || 0)) {
      return res.status(401).json({ message: 'Cần đăng nhập' });
    }
    req.userId = String(user._id);
    req.userRole = user.role;
    req.sessionVersion = user.sessionVersion || 0;
    const header = String(req.headers.authorization || '');
    if (header.startsWith('Bearer ')) {
      setSessionCookie(res, token);
    }
    next();
  } catch (_error) {
    res.status(401).json({ message: 'Cần đăng nhập' });
  }
};

module.exports = { verifyToken };
