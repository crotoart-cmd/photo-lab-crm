/**
 * Smart POS scan — tra mã vạch/QR/serial ra cart item để bán nhanh
 * POST /api/retail/smart-sale/scan   { code }
 * POST /api/retail/smart-sale/vision { image_base64 }  → khớp máy ảnh trong kho
 */
const express = require('express');
const { verifyToken } = require('./auth');
const FilmStock = require('../models/FilmStock');
const BatteryStock = require('../models/BatteryStock');
const CameraStock = require('../models/CameraStock');
const { identifyVision } = require('../services/retailIntakeService');
const { computeTrueCost, isSaleBlocked } = require('../services/cameraLifecycleService');

const router = express.Router();
const num = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function resolveCode(code) {
  const raw = String(code || '').trim();
  const upper = raw.toUpperCase();

  /* ── Film SKU / barcode ── */
  const batches = await FilmStock.aggregate([
    {
      $match: {
        quantity: { $gt: 0 },
        $or: [
          { sku_code: upper },
          { barcode: upper },
          { sku_code: new RegExp(`^${esc(raw)}$`, 'i') },
          { barcode: new RegExp(`^${esc(raw)}$`, 'i') },
        ],
      },
    },
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
        brand_group: { $first: '$brand_group' },
        total_quantity: { $sum: '$quantity' },
        nearest_expiry: { $first: '$expiry_date' },
      },
    },
  ]);

  if (batches.length > 0) {
    const f = batches[0];
    return {
      product_group: 'film',
      code: f.sku_code,
      name: f.name,
      brand_group: f.brand_group,
      cost: num(f.cost),
      list_price: num(f.price),
      floor_price: num(f.floor_price),
      stock_qty: num(f.total_quantity),
      nearest_expiry: f.nearest_expiry,
      default_qty: 1,
      match_source: 'sku',
    };
  }

  /* ── Battery SKU / barcode ── */
  const bat = await BatteryStock.findOne({
    quantity: { $gt: 0 },
    $or: [{ sku_code: upper }, { barcode: upper }],
  });
  if (bat) {
    return {
      product_group: 'battery',
      code: bat.sku_code,
      name: bat.name,
      brand_group: bat.brand_group,
      battery_type: bat.battery_type,
      cost: num(bat.cost),
      list_price: num(bat.price),
      floor_price: num(bat.floor_price),
      stock_qty: num(bat.quantity),
      default_qty: 1,
      match_source: 'sku',
    };
  }

  /* ── Camera: camera_code, barcode, serial ── */
  const cam = await CameraStock.findOne({
    $or: [
      { camera_code: upper },
      { barcode: upper },
      { serial_number: upper },
      { camera_code: new RegExp(`^${esc(raw)}$`, 'i') },
      { serial_number: new RegExp(`^${esc(raw)}$`, 'i') },
    ],
  });
  if (cam) {
    const true_cost = computeTrueCost(cam);
    const saleGate = isSaleBlocked(cam);
    if (saleGate.blocked && cam.status !== 'Da_Ban') {
      return {
        product_group: 'camera',
        code: cam.camera_code,
        camera_id: String(cam._id),
        serial_number: cam.serial_number,
        name: cam.model_name,
        brand_group: cam.brand_group,
        condition_note: cam.condition_note,
        condition_grade: cam.condition_grade,
        defect_tags: cam.defect_tags || [],
        status: cam.status,
        cost: num(cam.cost),
        true_cost,
        total_repair_cost: num(cam.total_repair_cost),
        list_price: num(cam.price),
        floor_price: Math.max(num(cam.floor_price), true_cost),
        stock_qty: cam.status === 'San_Hang' ? 1 : 0,
        default_qty: 1,
        match_source: 'serial',
        sale_blocked: true,
        sale_block_reason: saleGate.reason,
      };
    }
    if (cam.status !== 'San_Hang') return null;

    return {
      product_group: 'camera',
      code: cam.camera_code,
      camera_id: String(cam._id),
      serial_number: cam.serial_number,
      name: cam.model_name,
      brand_group: cam.brand_group,
      condition_note: cam.condition_note,
      condition_grade: cam.condition_grade,
      defect_tags: cam.defect_tags || [],
      status: cam.status,
      cost: num(cam.cost),
      true_cost,
      total_repair_cost: num(cam.total_repair_cost),
      list_price: num(cam.price),
      floor_price: Math.max(num(cam.floor_price), true_cost),
      stock_qty: 1,
      default_qty: 1,
      match_source: 'serial',
      sale_blocked: false,
    };
  }

  return null;
}

/* ── scan barcode → cart item ── */
router.post('/scan', verifyToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !String(code).trim()) {
      return res.status(400).json({ message: 'Thiếu mã barcode / QR' });
    }
    const item = await resolveCode(String(code).trim());
    if (!item) {
      return res.status(404).json({ message: `Không tìm thấy sản phẩm có mã "${code}" trong kho`, code });
    }
    res.json({ item });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tra cứu mã bán hàng', error: err.message });
  }
});

/* ── vision → khớp máy ảnh sẵn hàng ── */
router.post('/vision', verifyToken, async (req, res) => {
  try {
    const { image_base64 } = req.body;
    if (!image_base64) return res.status(400).json({ message: 'Thiếu ảnh' });

    const detected = await identifyVision(image_base64);
    const openai_configured = Boolean(process.env.OPENAI_API_KEY);

    /* Tìm máy khớp model trong kho */
    const brand = (detected.brand || '').toLowerCase();
    const model = (detected.model_name || detected.name || '').toLowerCase();

    let matchedCam = null;
    if (brand || model) {
      const keyword = `${brand} ${model}`.trim();
      const regex = new RegExp(keyword.split(' ').filter(Boolean).join('.*'), 'i');
      matchedCam = await CameraStock.findOne({
        status: 'San_Hang',
        model_name: regex,
      });
    }

    /* Nếu không khớp, lấy máy sẵn hàng đầu tiên (tốt hơn là báo lỗi) */
    if (!matchedCam) {
      matchedCam = await CameraStock.findOne({ status: 'San_Hang' }).sort({ createdAt: -1 });
    }

    if (!matchedCam) {
      return res.status(404).json({
        message: 'Không có máy ảnh nào sẵn hàng trong kho',
        vision_detected: detected,
      });
    }

    res.json({
      item: {
        product_group: 'camera',
        code: matchedCam.camera_code,
        camera_id: String(matchedCam._id),
        serial_number: matchedCam.serial_number,
        name: matchedCam.model_name,
        brand_group: matchedCam.brand_group,
        condition_note: matchedCam.condition_note,
        cost: num(matchedCam.cost),
        list_price: num(matchedCam.price),
        floor_price: num(matchedCam.floor_price),
        stock_qty: 1,
        default_qty: 1,
        match_source: 'vision',
      },
      vision_detected: detected,
      openai_configured,
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi AI Vision bán hàng', error: err.message });
  }
});

module.exports = router;
