const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { MAX_USERS, OWNER_EMAIL, isOwnerRole } = require('../config/users');
const { authWithUser, requireOwner } = require('../middleware/authz');

const router = express.Router();

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: isOwnerRole(user.role) || user.email === OWNER_EMAIL ? 'owner' : 'staff',
  phone: user.phone || '',
  status: user.status,
});

router.get('/', ...authWithUser, requireOwner, async (_req, res) => {
  try {
    const users = await User.find().select('-password').sort({ role: 1, createdAt: 1 });
    const normalized = users.map((u) => {
      const row = publicUser(u);
      if (u.email === OWNER_EMAIL) row.role = 'owner';
      return row;
    });
    res.json({
      users: normalized,
      maxUsers: MAX_USERS,
      staffSlotAvailable: users.length < MAX_USERS,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải danh sách', error: error.message });
  }
});

router.post(
  '/',
  ...authWithUser,
  requireOwner,
  [
    body('name').notEmpty().withMessage('Cần họ tên nhân viên'),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const count = await User.countDocuments();
      if (count >= MAX_USERS) {
        return res.status(400).json({ message: 'Hệ thống chỉ cho phép tối đa 2 tài khoản' });
      }

      const email = req.body.email.toLowerCase();
      if (email === OWNER_EMAIL) {
        return res.status(400).json({ message: 'Email này dành cho chủ hệ thống' });
      }

      const exists = await User.findOne({ email });
      if (exists) {
        return res.status(400).json({ message: 'Email đã tồn tại' });
      }

      const user = await User.create({
        name: req.body.name.trim(),
        email,
        password: req.body.password,
        role: 'staff',
        phone: req.body.phone || '',
      });

      res.status(201).json({ message: 'Đã tạo tài khoản nhân viên', user: publicUser(user) });
    } catch (error) {
      res.status(500).json({ message: 'Lỗi tạo nhân viên', error: error.message });
    }
  }
);

router.patch(
  '/:id',
  ...authWithUser,
  requireOwner,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'Không tìm thấy' });
      if (user.email === OWNER_EMAIL) {
        return res.status(403).json({ message: 'Không sửa chủ hệ thống tại đây — dùng Hồ sơ của bạn' });
      }

      const { name, email, password, status, phone } = req.body;
      if (name) user.name = String(name).trim();
      if (phone !== undefined) user.phone = phone;
      if (status && ['active', 'inactive'].includes(status)) user.status = status;
      if (email) {
        const lower = email.toLowerCase();
        if (lower === OWNER_EMAIL) {
          return res.status(400).json({ message: 'Email này dành cho chủ hệ thống' });
        }
        const taken = await User.findOne({ email: lower });
        if (taken && String(taken._id) !== String(user._id)) {
          return res.status(400).json({ message: 'Email đã được dùng' });
        }
        user.email = lower;
      }
      if (password) user.password = password;

      await user.save();
      res.json({ message: 'Đã cập nhật nhân viên', user: publicUser(user) });
    } catch (error) {
      res.status(500).json({ message: 'Lỗi cập nhật', error: error.message });
    }
  }
);

module.exports = router;
