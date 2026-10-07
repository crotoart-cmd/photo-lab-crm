const express = require('express');
const Customer = require('../models/Customer');
const { verifyToken } = require('./auth');
const { validateCustomerInput } = require('../utils/customerNormalize');
const {
  getEnrichedCustomers,
  getCustomerProfile,
  getCareTasks,
  findDuplicateGroups,
  mergeCustomers,
} = require('../services/customerInsights');

const router = express.Router();

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Tìm khách: SĐT, email, tên, mã KH
router.get('/search', verifyToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json([]);
    }

    const regex = new RegExp(escapeRegex(q), 'i');
    const phoneDigits = q.replace(/\D/g, '');
    const or = [
      { email: regex },
      { firstName: regex },
      { lastName: regex },
      { customerCode: regex },
    ];

    if (phoneDigits.length >= 3) {
      or.push({ phone: { $regex: phoneDigits } });
    } else {
      or.push({ phone: regex });
    }

    const customers = await Customer.find({ $or: or })
      .sort({ updatedAt: -1 })
      .limit(25);

    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tìm khách hàng', error: error.message });
  }
});

// Tra cứu 1 khách (QR / mã / SĐT / email) — dùng trước GET /:id
router.get('/lookup', verifyToken, async (req, res) => {
  try {
    const { id, code, phone, email, q } = req.query;
    let customer = null;

    if (id) {
      customer = await Customer.findById(id);
    } else if (code) {
      customer = await Customer.findOne({ customerCode: String(code).trim().toUpperCase() });
    } else if (email) {
      customer = await Customer.findOne({ email: String(email).trim().toLowerCase() });
    } else if (phone) {
      const digits = String(phone).replace(/\D/g, '');
      customer = await Customer.findOne({ phone: { $regex: digits } });
    } else if (q) {
      const found = await Customer.find({
        $or: [
          { customerCode: new RegExp(`^${escapeRegex(q.trim())}$`, 'i') },
          { email: new RegExp(`^${escapeRegex(q.trim())}$`, 'i') },
          { phone: { $regex: q.replace(/\D/g, '') } },
        ],
      }).limit(1);
      customer = found[0];
    }

    if (!customer) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tra cứu khách', error: error.message });
  }
});

// Create customer
router.post('/', verifyToken, async (req, res) => {
  try {
    const { errors, normalized } = validateCustomerInput(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors.join('. '), errors });
    }

    const existing = await Customer.find({
      $or: [{ email: normalized.email }, { phone: normalized.phone }],
    }).limit(5);

    const customer = new Customer(normalized);
    await customer.save();
    res.status(201).json({
      message: 'Customer created',
      customer,
      possibleDuplicates: existing.filter((c) => String(c._id) !== String(customer._id)),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating customer', error: error.message });
  }
});

// Danh sách khách + tag/LTV/stats
router.get('/enriched', verifyToken, async (req, res) => {
  try {
    const customers = await getEnrichedCustomers();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải khách hàng', error: error.message });
  }
});

// Nhóm khách trùng
router.get('/duplicates', verifyToken, async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(findDuplicateGroups(customers));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi phát hiện trùng', error: error.message });
  }
});

// Danh sách chăm sóc sáng
router.get('/care-tasks', verifyToken, async (req, res) => {
  try {
    res.json(await getCareTasks());
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải danh sách chăm sóc', error: error.message });
  }
});

// Gộp khách trùng
router.post('/merge', verifyToken, async (req, res) => {
  try {
    const { keepId, removeId } = req.body;
    if (!keepId || !removeId) {
      return res.status(400).json({ message: 'Thiếu keepId hoặc removeId' });
    }
    const profile = await mergeCustomers(keepId, removeId);
    res.json({ message: 'Đã gộp khách hàng', profile });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Gộp khách thất bại' });
  }
});

// Get all customers
router.get('/', verifyToken, async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers', error: error.message });
  }
});

// Thống kê tự động theo lịch sử phiếu film
router.get('/analytics', verifyToken, async (req, res) => {
  try {
    const customers = await getEnrichedCustomers();
    const list = customers.map((c) => ({
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      phone: c.phone,
      totalOrders: c.stats.visitCount,
      totalRolls: c.stats.rollCount ?? c.stats.visitCount,
      lastVisit: c.stats.lastVisit,
      favoriteProcess: c.stats.favoriteProcess,
      ltvGrade: c.ltvGrade,
      tags: c.tags,
    }));
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi thống kê khách hàng', error: error.message });
  }
});

// Gán mã KH cho khách cũ (chưa có mã)
router.post('/backfill-codes', verifyToken, async (req, res) => {
  try {
    const missing = await Customer.find({ $or: [{ customerCode: null }, { customerCode: '' }] });
    let count = 0;
    for (const c of missing) {
      const total = await Customer.countDocuments();
      c.customerCode = `KH-${String(total + 1).padStart(6, '0')}`;
      await c.save();
      count += 1;
    }
    res.json({ message: `Đã gán mã cho ${count} khách hàng`, count });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi gán mã', error: error.message });
  }
});

// Hồ sơ 360 khách hàng
router.get('/:id/profile', verifyToken, async (req, res) => {
  try {
    const profile = await getCustomerProfile(req.params.id);
    if (!profile) return res.status(404).json({ message: 'Customer not found' });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải hồ sơ khách', error: error.message });
  }
});

// Get customer by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer', error: error.message });
  }
});

// Update customer
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { errors, normalized } = validateCustomerInput(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors.join('. '), errors });
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { ...normalized, updatedAt: Date.now() },
      { new: true }
    );
    res.json({ message: 'Customer updated', customer });
  } catch (error) {
    res.status(500).json({ message: 'Error updating customer', error: error.message });
  }
});

// Delete customer
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting customer', error: error.message });
  }
});

module.exports = router;
