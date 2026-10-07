const express = require('express');
const Film = require('../models/Film');
const Inventory = require('../models/Inventory');
const Customer = require('../models/Customer');
const RetailSale = require('../models/RetailSale');
const CameraStock = require('../models/CameraStock');
const FilmStock = require('../models/FilmStock');
const BatteryStock = require('../models/BatteryStock');
const { verifyToken } = require('./auth');
const { buildDashboardAnalytics } = require('../services/dashboardAnalyticsService');
const { ensureSampleRetailSales } = require('../services/ensureSampleRetailSales');

const router = express.Router();
const qtyForAlert = (item) => (item.category === 'chemical' ? Number(item.quantityMl || 0) : Number(item.quantity || 0));

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

router.get('/today', verifyToken, async (req, res) => {
  try {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [
      receivedToday,
      processing,
      completed,
      delivered,
      waitingPickup,
      lowStockItems,
      totalCustomers,
      todaySales,
      cameraReady,
      filmBatches,
      batterySkus,
      recentSales,
    ] = await Promise.all([
      Film.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
      Film.countDocuments({ status: 'processing' }),
      Film.countDocuments({ status: 'completed' }),
      Film.countDocuments({
        status: 'delivered',
        deliveredAt: { $gte: todayStart, $lte: todayEnd },
      }),
      Film.countDocuments({ status: { $in: ['received', 'processing'] } }),
      Inventory.find().then((items) => items.filter((i) => qtyForAlert(i) <= Number(i.minStock || 0))),
      Customer.countDocuments({ status: 'active' }),
      RetailSale.find({ createdAt: { $gte: todayStart, $lte: todayEnd } }).lean(),
      CameraStock.countDocuments({ status: 'San_Hang' }),
      FilmStock.countDocuments({ quantity: { $gt: 0 } }),
      BatteryStock.countDocuments({ quantity: { $gt: 0 } }),
      RetailSale.find({ createdAt: { $gte: todayStart, $lte: todayEnd } })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const revenueToday = todaySales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

    const readyForPickup = completed;

    const inventoryByCategory = await Inventory.aggregate([
      {
        $group: {
          _id: '$category',
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
        },
      },
    ]);

    const chemicalWarnings = lowStockItems
      .filter((item) => item.category === 'chemical')
      .map((item) => ({
        _id: item._id,
        itemName: item.itemName,
        quantity: item.quantityMl,
        minStock: item.minStock,
        unit: 'ml',
      }));

    res.json({
      date: todayStart.toISOString().split('T')[0],
      films: {
        receivedToday,
        processing,
        completed,
        deliveredToday: delivered,
        waitingPickup,
        readyForPickup,
      },
      retail: {
        salesToday: todaySales.length,
        revenueToday,
        cameraReady,
        filmBatches,
        batterySkus,
        recentSales: recentSales.map((s) => ({
          code: s.code,
          name: s.name,
          amount: s.total_amount,
          product_group: s.product_group,
        })),
      },
      customers: { active: totalCustomers },
      inventory: {
        byCategory: inventoryByCategory,
        lowStockCount: lowStockItems.length,
        lowStockItems: lowStockItems.slice(0, 10),
        chemicalWarnings,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard', error: error.message });
  }
});

router.get('/monthly', verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    const [totalReceived, totalDelivered, statusBreakdown] = await Promise.all([
      Film.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } }),
      Film.countDocuments({
        status: 'delivered',
        deliveredAt: { $gte: monthStart, $lte: monthEnd },
      }),
      Film.aggregate([
        { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      totalReceived,
      totalDelivered,
      statusBreakdown: statusBreakdown.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {}),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching monthly report', error: error.message });
  }
});

router.get('/repair-ops', verifyToken, async (req, res) => {
  try {
    const { getRepairOpsMarket } = require('../services/dashboardAnalyticsService');
    const market = await getRepairOpsMarket();
    res.json(market);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải vận hành sửa chữa', error: error.message });
  }
});

router.get('/analytics', verifyToken, async (req, res) => {
  try {
    const period = [
      'day',
      'yesterday',
      'week',
      'last14',
      'last30',
      'month',
      'quarter',
      'year',
      'custom',
    ].includes(req.query.period)
      ? req.query.period
      : 'month';
    const data = await buildDashboardAnalytics(period, {
      start: req.query.start,
      end: req.query.end,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải phân tích dashboard', error: error.message });
  }
});

router.post('/seed-demo-retail', verifyToken, async (req, res) => {
  try {
    const result = await ensureSampleRetailSales({ force: Boolean(req.body?.force) });
    res.json({
      message:
        result.created > 0
          ? `Đã nạp ${result.created} đơn bán demo`
          : 'Đơn demo đã có sẵn — không thêm mới',
      ...result,
    });
  } catch (error) {
    res.status(500).json({ message: 'Không nạp được dữ liệu demo', error: error.message });
  }
});

module.exports = router;
