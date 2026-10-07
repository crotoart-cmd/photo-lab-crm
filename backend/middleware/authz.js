const User = require('../models/User');
const { isOwnerRole } = require('../config/users');
const { verifyToken } = require('./verifyToken');

const loadUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Tài khoản không hợp lệ hoặc đã khóa' });
    }
    req.user = user;
    req.userRole = user.role;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xác thực', error: error.message });
  }
};

const requireOwner = (req, res, next) => {
  if (!isOwnerRole(req.userRole)) {
    return res.status(403).json({ message: 'Chỉ chủ hệ thống mới có quyền này' });
  }
  next();
};

const authWithUser = [verifyToken, loadUser];

module.exports = { loadUser, requireOwner, authWithUser, isOwnerRole };
