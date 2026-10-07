const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const { OWNER_EMAIL, isOwnerRole } = require('../config/users');
const { authWithUser } = require('../middleware/authz');

const router = express.Router();

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: isOwnerRole(user.role) ? 'owner' : 'staff',
  phone: user.phone || '',
  status: user.status,
});

const { verifyToken } = require('../middleware/verifyToken');

/** Đăng ký công khai đã tắt — tạo nhân viên qua POST /api/users (chủ hệ thống). */
router.post('/register', (_req, res) => {
  res.status(403).json({
    message: 'Không cho đăng ký công khai. Chủ hệ thống tạo tài khoản nhân viên trong mục Hồ sơ.',
  });
});

router.get('/me', ...authWithUser, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch(
  '/profile',
  ...authWithUser,
  [
    body('name').optional().notEmpty().withMessage('Tên không được trống'),
    body('email').optional().isEmail(),
    body('password').optional().isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password } = req.body;
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

      const owner = isOwnerRole(user.role);

      if (name) user.name = name.trim();
      if (password) user.password = password;

      if (email && email.toLowerCase() !== user.email) {
        if (!owner) {
          return res.status(403).json({ message: 'Chỉ chủ hệ thống được đổi email đăng nhập' });
        }
        const taken = await User.findOne({ email: email.toLowerCase() });
        if (taken && String(taken._id) !== String(user._id)) {
          return res.status(400).json({ message: 'Email đã được dùng' });
        }
        user.email = email.toLowerCase();
      }

      await user.save();
      res.json({ message: 'Đã cập nhật hồ sơ', user: publicUser(user) });
    } catch (error) {
      res.status(500).json({ message: 'Lỗi cập nhật hồ sơ', error: error.message });
    }
  }
);

// Login
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const email = String(req.body.email || '').trim().toLowerCase();
    const { password } = req.body;
    let user = await User.findOne({ email });

    if (!user) {
      const { OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME } = require('../config/users');
      if (email === OWNER_EMAIL) {
        const { ensureOwner } = require('../services/ensureOwner');
        user = await ensureOwner();
      } else {
        return res.status(400).json({ message: 'Không tìm thấy tài khoản với email này' });
      }
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa' });
    }

    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Mật khẩu không đúng' });
    }

    const role = isOwnerRole(user.role) ? 'owner' : 'staff';
    const token = jwt.sign(
      { userId: user._id, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      message: 'Login successful',
      token,
      user: publicUser(user),
      isOwner: role === 'owner',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
module.exports.verifyToken = verifyToken; // tương thích routes cũ
