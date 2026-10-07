const express = require('express');
const { verifyToken } = require('./auth');
const FilmStock = require('../models/FilmStock');
const BatteryStock = require('../models/BatteryStock');
const CameraStock = require('../models/CameraStock');
const RetailSale = require('../models/RetailSale');
const Customer = require('../models/Customer');
const { formatEmailNote } = require('../services/emailService');
const {
  processRetailSaleItem,
  assertRetailSaleItemSellable,
  sendSaleReceiptEmail,
} = require('../services/retailSaleService');
const {
  getCameraProfile,
  addRepairEvent,
  updateCameraStatus,
  getRepairOpsSummary,
} = require('../services/cameraRepairService');
const { mapCameraForClient } = require('../services/cameraLifecycleService');
const { fullName, normalizeEmail } = require('../utils/customerNormalize');

const router = express.Router();

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const saleCode = () => `SALE-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const formatVnd = (n) => `${Math.round(num(n)).toLocaleString('vi-VN')}đ`;

/** Email/tên người nhận — ưu tiên hồ sơ khách khi có customerId */
async function resolveBuyerForEmail({ customerId, customer_email, customer_name }) {
  let email = normalizeEmail(customer_email);
  let name = String(customer_name || '').trim();

  if (customerId) {
    const customer = await Customer.findById(customerId).select('email firstName lastName');
    if (customer) {
      if (!email && customer.email) email = normalizeEmail(customer.email);
      if (!name) name = fullName(customer);
    }
  }

  return {
    customer_email: email || undefined,
    customer_name: name || undefined,
  };
}

const dbErrorMessage = (error, fallback) => {
  if (error.code === 11000) {
    const key = Object.keys(error.keyPattern || {})[0] || 'mã';
    return `Trùng ${key} — đổi mã hoặc cập nhật lô/SKU hiện có`;
  }
  if (error.name === 'ValidationError') {
    return Object.values(error.errors || {})
      .map((e) => e.message)
      .join('; ');
  }
  return error.message || fallback;
};

const pushCostHistory = (row, cost) => {
  if (!cost || cost <= 0) return;
  if (!row.cost_history) row.cost_history = [];
  row.cost_history.push({ date: new Date(), cost });
};

const floorViolation = (unitPrice, floorPrice) => {
  const offer = num(unitPrice);
  const floor = num(floorPrice);
  if (floor > 0 && offer < floor) {
    return `Không thể bán! Giá offer (${formatVnd(offer)}) thấp hơn ngưỡng giới hạn an toàn (${formatVnd(floor)}).`;
  }
  return null;
};

const applyPricingFields = (payload) => {
  const cost = num(payload.cost);
  const price = num(payload.price);
  const floor = num(payload.floor_price) || cost;
  return {
    ...payload,
    cost,
    price,
    floor_price: floor,
  };
};

router.get('/summary', verifyToken, async (req, res) => {
  try {
    const [filmBatches, batterySkus, cameraReady, cameraSold, cameraWaiting, cameraInRepair] =
      await Promise.all([
      FilmStock.countDocuments(),
      BatteryStock.countDocuments(),
      CameraStock.countDocuments({ status: 'San_Hang' }),
      CameraStock.countDocuments({ status: 'Da_Ban' }),
      CameraStock.countDocuments({ status: 'Cho_Sua' }),
      CameraStock.countDocuments({ status: 'Dang_Sua' }),
    ]);
    res.json({
      filmBatches,
      batterySkus,
      cameraReady,
      cameraSold,
      cameraWaiting,
      cameraInRepair,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải tổng quan bán lẻ', error: error.message });
  }
});

router.get('/film-stock', verifyToken, async (req, res) => {
  try {
    const { q } = req.query;
    const filter = {};
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ sku_code: regex }, { name: regex }, { brand: regex }];
    }
    const rows = await FilmStock.find(filter).sort({ sku_code: 1, expiry_date: 1 });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải film stock', error: error.message });
  }
});

router.get('/film-sku', verifyToken, async (req, res) => {
  try {
    const data = await FilmStock.aggregate([
      { $match: { quantity: { $gt: 0 } } },
      { $sort: { expiry_date: 1 } },
      {
        $group: {
          _id: '$sku_code',
          sku_code: { $first: '$sku_code' },
          name: { $first: '$name' },
          iso: { $first: '$iso' },
          size: { $first: '$size' },
          cost: { $first: '$cost' },
          price: { $first: '$price' },
          floor_price: { $first: '$floor_price' },
          total_quantity: { $sum: '$quantity' },
          nearest_expiry: { $first: '$expiry_date' },
        },
      },
      { $sort: { sku_code: 1 } },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải SKU film', error: error.message });
  }
});

router.post('/film-stock', verifyToken, async (req, res) => {
  try {
    const sku = String(req.body.sku_code || '').toUpperCase();
    const name = String(req.body.name || '').trim();
    const qty = Number(req.body.quantity || 0);
    if (!sku) return res.status(400).json({ message: 'Thiếu mã SKU film' });
    if (!name) return res.status(400).json({ message: 'Thiếu tên film' });
    if (!req.body.expiry_date) return res.status(400).json({ message: 'Film cần hạn sử dụng (expiry_date)' });
    if (qty <= 0) return res.status(400).json({ message: 'Số cuộn phải lớn hơn 0' });

    const payload = applyPricingFields({
      ...req.body,
      sku_code: sku,
      name,
      film_type: req.body.film_type,
      exposures: req.body.exposures,
      color_character: req.body.color_character,
      catalog_key: req.body.catalog_key,
      quantity: qty,
      expiry_date: new Date(req.body.expiry_date),
      updatedAt: Date.now(),
    });
    if (payload.cost > 0) {
      payload.cost_history = [{ date: new Date(), cost: payload.cost }];
    }
    const row = await FilmStock.create(payload);
    res.status(201).json({ message: 'Đã tạo lô film', row });
  } catch (error) {
    const detail = dbErrorMessage(error, 'Lỗi tạo lô film');
    res.status(400).json({ message: detail, error: error.message });
  }
});

router.patch('/film-stock/:id', verifyToken, async (req, res) => {
  try {
    const row = await FilmStock.findById(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy lô film' });
    Object.assign(row, req.body, { updatedAt: Date.now() });
    if (req.body.sku_code) row.sku_code = String(req.body.sku_code).toUpperCase();
    if (req.body.quantity != null) row.quantity = Number(req.body.quantity);
    if (req.body.cost != null) row.cost = num(req.body.cost);
    if (req.body.price != null) row.price = num(req.body.price);
    if (req.body.floor_price != null) row.floor_price = num(req.body.floor_price);
    await row.save();
    res.json({ message: 'Đã cập nhật lô film', row });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật lô film', error: error.message });
  }
});

router.get('/battery-stock', verifyToken, async (req, res) => {
  try {
    const { q } = req.query;
    const filter = {};
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ sku_code: regex }, { name: regex }, { battery_type: regex }];
    }
    const rows = await BatteryStock.find(filter).sort({ sku_code: 1 });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải battery stock', error: error.message });
  }
});

router.post('/battery-stock', verifyToken, async (req, res) => {
  try {
    const sku = String(req.body.sku_code || '').toUpperCase();
    const name = String(req.body.name || '').trim();
    const qty = Number(req.body.quantity || 0);
    if (!sku) return res.status(400).json({ message: 'Thiếu mã SKU pin' });
    if (!name) return res.status(400).json({ message: 'Thiếu tên pin' });
    if (!String(req.body.battery_type || '').trim()) {
      return res.status(400).json({ message: 'Thiếu loại pin (battery_type)' });
    }
    if (qty <= 0) return res.status(400).json({ message: 'Số lượng phải lớn hơn 0' });

    const pricing = applyPricingFields(req.body);
    let row = await BatteryStock.findOne({ sku_code: sku });
    if (row) {
      row.quantity += qty;
      row.name = name;
      row.battery_type = String(req.body.battery_type).trim();
      if (pricing.cost > 0) {
        row.cost = pricing.cost;
        pushCostHistory(row, pricing.cost);
      }
      if (pricing.price > 0) row.price = pricing.price;
      if (pricing.floor_price > 0) row.floor_price = pricing.floor_price;
      row.updatedAt = Date.now();
      await row.save();
      return res.status(200).json({ message: 'Đã cộng thêm pin vào SKU hiện có', row });
    }

    row = await BatteryStock.create({
      ...req.body,
      sku_code: sku,
      name,
      battery_type: String(req.body.battery_type).trim(),
      quantity: qty,
      cost: pricing.cost,
      price: pricing.price,
      floor_price: pricing.floor_price,
      cost_history: pricing.cost > 0 ? [{ date: new Date(), cost: pricing.cost }] : [],
      updatedAt: Date.now(),
    });
    res.status(201).json({ message: 'Đã tạo SKU pin', row });
  } catch (error) {
    const detail = dbErrorMessage(error, 'Lỗi tạo SKU pin');
    res.status(400).json({ message: detail, error: error.message });
  }
});

router.patch('/battery-stock/:id', verifyToken, async (req, res) => {
  try {
    const row = await BatteryStock.findById(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy SKU pin' });
    Object.assign(row, req.body, { updatedAt: Date.now() });
    if (req.body.sku_code) row.sku_code = String(req.body.sku_code).toUpperCase();
    if (req.body.quantity != null) row.quantity = Number(req.body.quantity);
    if (req.body.cost != null) row.cost = num(req.body.cost);
    if (req.body.price != null) row.price = num(req.body.price);
    if (req.body.floor_price != null) row.floor_price = num(req.body.floor_price);
    await row.save();
    res.json({ message: 'Đã cập nhật SKU pin', row });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật SKU pin', error: error.message });
  }
});

router.get('/camera-stock', verifyToken, async (req, res) => {
  try {
    const { q, status } = req.query;
    const filter = {};
    if (status) {
      const statuses = String(status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ camera_code: regex }, { model_name: regex }, { serial_number: regex }];
    }
    const rows = await CameraStock.find(filter).sort({ updatedAt: -1 });
    res.json(rows.map((row) => mapCameraForClient(row.toObject())));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải camera stock', error: error.message });
  }
});

router.post('/camera-stock', verifyToken, async (req, res) => {
  try {
    const {
      validateCameraSerial,
      resolveStoredSerial,
      isPlaceholderSerial,
    } = require('../services/cameraSerialService');
    const serialRaw = String(req.body.serial_number || '').trim();
    const serial = serialRaw.toUpperCase();
    const model = String(req.body.model_name || '').trim();
    if (!model) return res.status(400).json({ message: 'Thiếu tên model máy ảnh' });

    const noFactorySerial = Boolean(req.body.serial_is_generated);
    let code = String(req.body.camera_code || '').trim().toUpperCase();
    if (!code) {
      if (serial && !isPlaceholderSerial(serial)) {
        const modelSlug = model
          .replace(/[^A-Z0-9]/gi, '')
          .slice(0, 12)
          .toUpperCase();
        code = `CAM-${modelSlug}-SN${serial.replace(/[^A-Z0-9]/g, '').slice(-8)}`;
      } else {
        return res.status(400).json({ message: 'Cần mã quầy hoặc số sê-ri máy' });
      }
    }

    let estimatedYear = req.body.estimated_year;
    if (req.body.catalog_key && serial && !noFactorySerial) {
      const check = validateCameraSerial(req.body.catalog_key, serial);
      if (check.estimatedYear) estimatedYear = check.estimatedYear;
    }

    const storedSerial = resolveStoredSerial({
      serial_number: serial && !isPlaceholderSerial(serial) ? serial : '',
      camera_code: code,
      serial_is_generated: noFactorySerial,
    });

    const existing = await CameraStock.findOne({
      $or: [{ serial_number: storedSerial }, { camera_code: code }],
    });
    if (existing) {
      return res.status(400).json({
        message: `Mã đã tồn tại (${existing.camera_code})`,
      });
    }

    const pricing = applyPricingFields(req.body);

    const payload = {
      ...req.body,
      camera_code: code,
      model_name: model,
      serial_number: storedSerial,
      serial_is_generated: noFactorySerial,
      estimated_year: estimatedYear,
      cost: pricing.cost,
      price: pricing.price,
      floor_price: pricing.floor_price,
      status: req.body.status || 'San_Hang',
      updatedAt: Date.now(),
    };
    if (pricing.cost > 0) {
      payload.cost_history = [{ date: new Date(), cost: pricing.cost }];
    }
    const row = await CameraStock.create(payload);
    res.status(201).json({ message: 'Đã tạo mã máy ảnh', row });
  } catch (error) {
    const detail = dbErrorMessage(error, 'Lỗi tạo mã máy ảnh');
    res.status(400).json({ message: detail, error: error.message });
  }
});

router.patch('/camera-stock/:id', verifyToken, async (req, res) => {
  try {
    const row = await CameraStock.findById(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy máy ảnh' });
    Object.assign(row, req.body, { updatedAt: Date.now() });
    if (req.body.camera_code) row.camera_code = String(req.body.camera_code).toUpperCase();
    if (req.body.serial_number) row.serial_number = String(req.body.serial_number).toUpperCase();
    if (req.body.cost != null) row.cost = num(req.body.cost);
    if (req.body.price != null) row.price = num(req.body.price);
    if (req.body.floor_price != null) row.floor_price = num(req.body.floor_price);
    if (req.body.defect_tags) row.defect_tags = req.body.defect_tags;
    if (req.body.has_defect != null) row.has_defect = Boolean(req.body.has_defect);
    if (req.body.condition_grade) row.condition_grade = req.body.condition_grade;
    await row.save();
    res.json({ message: 'Đã cập nhật máy ảnh', row: mapCameraForClient(row.toObject()) });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật máy ảnh', error: error.message });
  }
});

router.get('/camera-stock/:id/profile', verifyToken, async (req, res) => {
  try {
    const profile = await getCameraProfile(req.params.id);
    if (!profile) return res.status(404).json({ message: 'Không tìm thấy máy ảnh' });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải hồ sơ máy', error: error.message });
  }
});

router.post('/camera-stock/:id/repairs', verifyToken, async (req, res) => {
  try {
    const result = await addRepairEvent(req.params.id, req.body, req.userId);
    res.status(201).json({ message: 'Đã lưu phiếu sửa', ...result });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi lưu phiếu sửa' });
  }
});

router.patch('/camera-stock/:id/status', verifyToken, async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!status) return res.status(400).json({ message: 'Thiếu trạng thái' });
    const row = await updateCameraStatus(req.params.id, status, note);
    res.json({ message: 'Đã cập nhật trạng thái', row });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi cập nhật trạng thái' });
  }
});

router.get('/camera-ops/summary', verifyToken, async (req, res) => {
  try {
    const summary = await getRepairOpsSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải báo cáo máy lỗi', error: error.message });
  }
});

router.post('/check-sale', verifyToken, async (req, res) => {
  try {
    const { customer_email, customer_name, customerId, ...saleBody } = req.body;
    const buyer = await resolveBuyerForEmail({ customerId, customer_email, customer_name });
    const { sale, profit } = await processRetailSaleItem(
      {
        ...saleBody,
        customerId,
        buyerName: buyer.customer_name,
        buyerEmail: buyer.customer_email,
      },
      req.userId
    );
    const emailResult = await sendSaleReceiptEmail({
      sales: [sale],
      customer_email: buyer.customer_email || sale.buyerEmail,
      customer_name: buyer.customer_name || sale.buyerName,
    });

    res.status(201).json({
      message: `Xác nhận bán thành công${formatEmailNote(emailResult)}`,
      sale,
      profit,
      emailSent: emailResult?.sent,
      emailSentTo: emailResult?.to || buyer.customer_email || null,
      emailSkipped: emailResult?.skipped,
      emailError: emailResult?.error || null,
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      message: status === 500 ? 'Lỗi check bán hàng' : error.message,
      error: error.message,
    });
  }
});

router.post('/checkout-cart', verifyToken, async (req, res) => {
  try {
    const { items = [], customer_email, customer_name, customerId } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }

    const buyer = await resolveBuyerForEmail({ customerId, customer_email, customer_name });

    // Tiền kiểm tra cả giỏ trước khi xuất kho — tránh bán dở dang
    // (món sau lỗi nhưng món trước đã trừ kho + đánh dấu đã bán).
    for (const item of items) {
      try {
        await assertRetailSaleItemSellable(item);
      } catch (err) {
        return res.status(err.status || 400).json({
          message: `Không thể thanh toán: ${item.name || item.code} — ${err.message}`,
          log: [{ name: item.name || item.code, error: err.message, ok: false }],
          partialSales: [],
        });
      }
    }

    const sales = [];
    const log = [];
    let totalProfit = 0;

    for (const item of items) {
      try {
        const result = await processRetailSaleItem(
          {
            ...item,
            customerId,
            buyerName: buyer.customer_name,
            buyerEmail: buyer.customer_email,
          },
          req.userId
        );
        sales.push(result.sale);
        totalProfit += result.profit;
        log.push({
          name: result.sale.name,
          sale_code: result.sale.sale_code,
          revenue: result.sale.total_amount,
          profit: result.profit,
          ok: true,
        });
      } catch (err) {
        log.push({
          name: item.name || item.code,
          error: err.message,
          ok: false,
        });
        return res.status(err.status || 400).json({
          message: 'Thanh toán dừng do lỗi xuất kho',
          log,
          partialSales: sales,
        });
      }
    }

    const emailResult = await sendSaleReceiptEmail({
      sales,
      customer_email: buyer.customer_email,
      customer_name: buyer.customer_name,
    });

    res.status(201).json({
      message: `Thanh toán ${sales.length} sản phẩm thành công${formatEmailNote(emailResult)}`,
      sales,
      profit: totalProfit,
      log,
      emailSent: emailResult?.sent,
      emailSentTo: emailResult?.to || buyer.customer_email || null,
      emailSkipped: emailResult?.skipped,
      emailError: emailResult?.error || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi thanh toán giỏ hàng', error: error.message });
  }
});

router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { group, limit = 50 } = req.query;
    const filter = {};
    if (group) filter.product_group = group;
    const rows = await RetailSale.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    const totals = rows.reduce(
      (acc, s) => {
        acc.revenue += num(s.total_amount);
        acc.cost += num(s.total_cost);
        acc.profit += num(s.profit);
        return acc;
      },
      { revenue: 0, cost: 0, profit: 0 }
    );
    res.json({ sales: rows, totals });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải lịch sử bán', error: error.message });
  }
});

router.use('/catalog', require('./retailCatalog'));
router.use('/smart-intake', require('./retailIntake'));
router.use('/smart-sale', require('./retailSale'));

module.exports = router;
