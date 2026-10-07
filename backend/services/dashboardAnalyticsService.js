const Film = require('../models/Film');
const Customer = require('../models/Customer');
const Inventory = require('../models/Inventory');
const RetailSale = require('../models/RetailSale');
const FilmStock = require('../models/FilmStock');
const CameraStock = require('../models/CameraStock');
const CameraRepairEvent = require('../models/CameraRepairEvent');
const { cameraHasDefect, computeTrueCost } = require('./cameraLifecycleService');
const { getRepairOpsSummary } = require('./cameraRepairService');

const LENS_NAME_RE = /lens|ống kính|nikkor|zeiss|summicron|planar|canon fd|pentax|minolta md/i;

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

const getDateRange = (period = 'month', queryStart, queryEnd) => {
  if (period === 'custom' && queryStart && queryEnd) {
    const start = startOfDay(new Date(`${queryStart}T12:00:00`));
    const end = endOfDay(new Date(`${queryEnd}T12:00:00`));
    if (start <= end) return { start, end, period: 'custom' };
  }

  const end = endOfDay();
  const start = startOfDay();

  if (period === 'day') return { start, end, period };
  if (period === 'yesterday') {
    const y = startOfDay();
    y.setDate(y.getDate() - 1);
    return { start: y, end: endOfDay(y), period: 'yesterday' };
  }
  if (period === 'week') {
    start.setDate(start.getDate() - 6);
    return { start, end, period };
  }
  if (period === 'last14') {
    start.setDate(start.getDate() - 13);
    return { start, end, period: 'last14' };
  }
  if (period === 'last30') {
    start.setDate(start.getDate() - 29);
    return { start, end, period: 'last30' };
  }
  if (period === 'quarter') {
    start.setMonth(start.getMonth() - 2);
    start.setDate(1);
    return { start, end, period };
  }
  if (period === 'year') {
    start.setMonth(0);
    start.setDate(1);
    return { start, end, period };
  }
  start.setDate(1);
  return { start, end, period: 'month' };
};

function getChartGranularity(start, end) {
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  if (days <= 1) return 'day';
  if (days <= 31) return 'month';
  if (days <= 120) return 'quarter';
  return 'year';
}

const classifySaleSegment = (sale) => {
  if (sale.product_group === 'film' || sale.product_group === 'battery') return 'film_supplies';
  if (sale.product_group === 'camera') {
    const name = String(sale.name || '').toLowerCase();
    if (LENS_NAME_RE.test(name)) return 'lens';
    return 'body';
  }
  return 'film_supplies';
};

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

const startOfWeek = (date = new Date()) => {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

function buildWeeklyBuckets(start, end) {
  const buckets = [];
  let cursor = startOfWeek(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    const label = cursor.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
    buckets.push({ key, label });
    cursor.setDate(cursor.getDate() + 7);
  }
  return buckets;
}

function buildMonthlyBuckets(start, end) {
  const buckets = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = startOfDay(end);
  while (cursor <= last) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ key, label: `T${cursor.getMonth() + 1}` });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function buildOrderBuckets(start, end, period) {
  if (period === 'day') {
    const base = startOfDay(start);
    return Array.from({ length: 24 }, (_, hour) => {
      const d = new Date(base);
      d.setHours(hour);
      return {
        key: `h${hour}`,
        label: `${String(hour).padStart(2, '0')}h`,
      };
    });
  }

  if (period === 'year') return buildMonthlyBuckets(start, end);
  if (period === 'quarter') return buildWeeklyBuckets(start, end);

  const buckets = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    const label =
      period === 'week'
        ? cursor.toLocaleDateString('vi-VN', { weekday: 'short' })
        : String(cursor.getDate());
    buckets.push({ key, label });
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

function orderBucketKey(date, period) {
  if (period === 'day') return `h${date.getHours()}`;
  if (period === 'year') {
    const d = startOfDay(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (period === 'quarter') return startOfWeek(date).toISOString().slice(0, 10);
  return startOfDay(date).toISOString().slice(0, 10);
}

async function getOrdersTimeSeries(start, end, period) {
  const sales = await RetailSale.find({ createdAt: { $gte: start, $lte: end } })
    .select('createdAt total_amount')
    .lean();

  const buckets = buildOrderBuckets(start, end, period);
  const map = Object.fromEntries(buckets.map((b) => [b.key, { orders: 0, revenue: 0 }]));

  for (const sale of sales) {
    const key = orderBucketKey(new Date(sale.createdAt), period);
    if (!map[key]) continue;
    map[key].orders += 1;
    map[key].revenue += Number(sale.total_amount || 0);
  }

  const points = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    orders: map[b.key].orders,
    revenue: map[b.key].revenue,
  }));

  return {
    points,
    totalOrders: sales.length,
    totalRevenue: sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0),
  };
}

async function getSalesPerformance(start, end, period = 'month') {
  const sales = await RetailSale.find({ createdAt: { $gte: start, $lte: end } }).lean();
  let revenue = 0;
  let cost = 0;
  let profit = 0;
  const segments = { body: 0, lens: 0, film_supplies: 0 };
  const productMap = {};

  for (const sale of sales) {
    revenue += Number(sale.total_amount || 0);
    cost += Number(sale.total_cost || 0);
    profit += Number(sale.profit || 0);
    const seg = classifySaleSegment(sale);
    segments[seg] += Number(sale.total_amount || 0);

    const key = `${sale.product_group}:${sale.code}`;
    if (!productMap[key]) {
      productMap[key] = {
        name: sale.name,
        code: sale.code,
        product_group: sale.product_group,
        quantity: 0,
        revenue: 0,
      };
    }
    productMap[key].quantity += Number(sale.quantity || 0);
    productMap[key].revenue += Number(sale.total_amount || 0);
  }

  const orderCount = sales.length;
  const segmentTotal = segments.body + segments.lens + segments.film_supplies;
  const orderSeries = await getOrdersTimeSeries(start, end, period);

  return {
    revenue,
    cost,
    profit,
    grossMarginPct: pct(profit, revenue),
    orderCount,
    aov: orderCount ? Math.round(revenue / orderCount) : 0,
    orderSeries,
    segments: {
      body: { revenue: segments.body, sharePct: pct(segments.body, segmentTotal) },
      lens: { revenue: segments.lens, sharePct: pct(segments.lens, segmentTotal) },
      film_supplies: { revenue: segments.film_supplies, sharePct: pct(segments.film_supplies, segmentTotal) },
    },
    topProducts: Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
  };
}

async function getInventorySupplyChain() {
  const now = new Date();
  const in90Days = new Date(now);
  in90Days.setDate(in90Days.getDate() + 90);
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);

  const skuAgg = await FilmStock.aggregate([
    {
      $group: {
        _id: '$sku_code',
        name: { $first: '$name' },
        brand: { $first: '$brand' },
        totalQty: { $sum: '$quantity' },
        nearestExpiry: { $min: '$expiry_date' },
        batches: { $sum: 1 },
      },
    },
    { $sort: { totalQty: 1, nearestExpiry: 1 } },
  ]);

  const outOfStock = skuAgg
    .filter((row) => row.totalQty <= 0)
    .map((row) => ({ sku: row._id, name: row.name, brand: row.brand }));

  const lowStock = skuAgg
    .filter((row) => row.totalQty > 0 && row.totalQty <= 3)
    .map((row) => ({
      sku: row._id,
      name: row.name,
      brand: row.brand,
      quantity: row.totalQty,
      nearestExpiry: row.nearestExpiry,
    }));

  const expiringSoon = await FilmStock.find({
    quantity: { $gt: 0 },
    expiry_date: { $lte: in90Days },
  })
    .sort({ expiry_date: 1 })
    .limit(12)
    .lean();

  const filmOutdate = expiringSoon
    .filter((row) => new Date(row.expiry_date) <= in30Days)
    .map((row) => ({
      sku: row.sku_code,
      name: row.name,
      quantity: row.quantity,
      expiry_date: row.expiry_date,
      daysLeft: Math.ceil((new Date(row.expiry_date) - now) / 86400000),
    }));

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const filmSoldQty = await RetailSale.aggregate([
    { $match: { product_group: 'film', createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: null, qty: { $sum: '$quantity' } } },
  ]);
  const soldLast30 = filmSoldQty[0]?.qty || 0;
  const currentFilmStock = skuAgg.reduce((sum, row) => sum + (row.totalQty > 0 ? row.totalQty : 0), 0);
  const filmTurnoverDays =
    soldLast30 > 0 && currentFilmStock > 0 ? Math.round((currentFilmStock / soldLast30) * 30) : null;

  const soldCameras = await CameraStock.find({
    status: 'Da_Ban',
    sold_at: { $exists: true },
    createdAt: { $exists: true },
  })
    .select('model_name sold_at createdAt')
    .lean();

  const cameraDaysOnHand = soldCameras
    .map((cam) => {
      const days = Math.ceil((new Date(cam.sold_at) - new Date(cam.createdAt)) / 86400000);
      return Number.isFinite(days) && days >= 0 ? days : null;
    })
    .filter((d) => d != null);

  const avgCameraDaysOnHand = cameraDaysOnHand.length
    ? Math.round(cameraDaysOnHand.reduce((a, b) => a + b, 0) / cameraDaysOnHand.length)
    : null;

  const chemicalLow = await Inventory.find({ category: 'chemical' }).lean();
  const chemicalAlerts = chemicalLow
    .filter((item) => Number(item.quantityMl || 0) <= Number(item.minStock || 0))
    .map((item) => ({
      itemName: item.itemName,
      quantityMl: item.quantityMl,
      minStock: item.minStock,
    }));

  return {
    outOfStock,
    lowStock,
    expiringSoon: expiringSoon.map((row) => ({
      sku: row.sku_code,
      name: row.name,
      quantity: row.quantity,
      expiry_date: row.expiry_date,
      daysLeft: Math.ceil((new Date(row.expiry_date) - now) / 86400000),
    })),
    filmOutdatePromo: filmOutdate,
    turnover: {
      filmDaysToSellStock: filmTurnoverDays,
      filmSoldLast30Days: soldLast30,
      currentFilmRolls: currentFilmStock,
      avgCameraDaysOnHand,
      cameraUnitsSampled: cameraDaysOnHand.length,
    },
    chemicalAlerts,
  };
}

async function getCustomerAnalytics(start, end) {
  const films = await Film.find({
    status: { $ne: 'cancelled' },
    createdAt: { $gte: start, $lte: end },
  })
    .populate('customerId', 'firstName lastName email')
    .lean();

  const allFilms = await Film.find({ status: { $ne: 'cancelled' } })
    .populate('customerId', 'email')
    .lean();

  const labByCustomer = {};
  for (const film of allFilms) {
    const cid = film.customerId?._id ? String(film.customerId._id) : null;
    if (!cid) continue;
    if (!labByCustomer[cid]) {
      labByCustomer[cid] = { orders: 0, rolls: 0, labRevenue: 0, newbieSignals: 0, proSignals: 0 };
    }
    labByCustomer[cid].orders += 1;
    labByCustomer[cid].rolls += film.quantity || 1;
    labByCustomer[cid].labRevenue += Number(film.intakeChecklist?.paymentAmount || 0);

    const fmt = film.intakeChecklist?.filmFormat;
    const proc = film.intakeChecklist?.processingProcess;
    if (fmt === '120' || proc === 'e6' || proc === 'bw_custom') {
      labByCustomer[cid].proSignals += 1;
    } else {
      labByCustomer[cid].newbieSignals += 1;
    }
  }

  const labCustomers = Object.values(labByCustomer);
  const repeatLabCustomers = labCustomers.filter((c) => c.orders >= 2).length;
  const oneTimeLabCustomers = labCustomers.filter((c) => c.orders === 1).length;
  const labRetentionPct = pct(repeatLabCustomers, labCustomers.length);

  const cameraBuyers = await RetailSale.countDocuments({
    product_group: 'camera',
    createdAt: { $gte: start, $lte: end },
  });

  let newbieOrders = 0;
  let proOrders = 0;
  for (const film of films) {
    const fmt = film.intakeChecklist?.filmFormat;
    const proc = film.intakeChecklist?.processingProcess;
    if (fmt === '120' || proc === 'e6' || proc === 'bw_custom') proOrders += 1;
    else newbieOrders += 1;
  }
  const segmentTotal = newbieOrders + proOrders;

  const periodLabRevenue = films.reduce(
    (sum, f) => sum + Number(f.intakeChecklist?.paymentAmount || 0),
    0
  );
  const allTimeLabRevenue = allFilms.reduce(
    (sum, f) => sum + Number(f.intakeChecklist?.paymentAmount || 0),
    0
  );

  const activeCustomers = await Customer.countDocuments({ status: 'active' });

  return {
    activeCustomers,
    labService: {
      periodRevenue: periodLabRevenue,
      allTimeRevenue: allTimeLabRevenue,
      periodOrders: films.length,
      periodRolls: films.reduce((sum, f) => sum + (f.quantity || 1), 0),
    },
    retention: {
      labRepeatCustomers: repeatLabCustomers,
      labOneTimeCustomers: oneTimeLabCustomers,
      labRetentionPct,
      cameraBuyersInPeriod: cameraBuyers,
      note: 'Máy ảnh thường mua 1–2 lần; film & lab đo retention qua phiếu tráng lặp lại.',
    },
    segments: {
      newbie: { orders: newbieOrders, sharePct: pct(newbieOrders, segmentTotal) },
      pro: { orders: proOrders, sharePct: pct(proOrders, segmentTotal) },
      labels: {
        newbie: 'Người mới (35mm, film giá rẻ, PnS)',
        pro: 'Chơi sâu (120, E6, B&W custom, máy cơ)',
      },
    },
  };
}

async function getMarketTrends(start, end, chartPeriod = 'month') {
  const filmSales = await RetailSale.find({
    product_group: 'film',
    createdAt: { $gte: start, $lte: end },
  }).lean();

  const buckets = buildOrderBuckets(start, end, chartPeriod);
  const bucketMap = Object.fromEntries(
    buckets.map((b) => [b.key, { key: b.key, label: b.label, sellTotal: 0, costTotal: 0, qty: 0 }])
  );

  for (const sale of filmSales) {
    const key = orderBucketKey(new Date(sale.createdAt), chartPeriod);
    const row = bucketMap[key];
    if (!row) continue;
    row.sellTotal += Number(sale.unit_price || 0);
    row.costTotal += Number(sale.unit_cost || 0);
    row.qty += 1;
  }

  const filmPriceTrend = buckets.map((b) => {
    const row = bucketMap[b.key];
    return {
      month: b.key,
      label: b.label,
      avgSellPrice: row.qty ? Math.round(row.sellTotal / row.qty) : 0,
      avgImportCost: row.qty ? Math.round(row.costTotal / row.qty) : 0,
      saleCount: row.qty,
    };
  });

  const stocks = await FilmStock.find().lean();
  const costByBucket = {};
  for (const batch of stocks) {
    for (const entry of batch.cost_history || []) {
      const d = new Date(entry.date);
      if (d < start || d > end) continue;
      const key = orderBucketKey(d, chartPeriod);
      if (!costByBucket[key]) costByBucket[key] = { sum: 0, count: 0 };
      costByBucket[key].sum += Number(entry.cost || 0);
      costByBucket[key].count += 1;
    }
  }

  const importCostTrend = buckets
    .map((b) => {
      const row = costByBucket[b.key];
      if (!row?.count) return null;
      return {
        month: b.key,
        label: b.label,
        avgImportCost: Math.round(row.sum / row.count),
      };
    })
    .filter(Boolean);

  const repair = await getRepairOpsMarket();

  return {
    filmPriceTrend,
    importCostTrend,
    ...repair,
  };
}

/** Snapshot sửa chữa — nhẹ, dùng cho mobile khi analytics đầy đủ timeout. */
async function getRepairOpsMarket() {
  const soldCameras = await CameraStock.find({ status: 'Da_Ban' }).lean();
  const readyCameras = await CameraStock.find({ status: { $in: ['San_Hang', 'Cho_Sua', 'Dang_Sua'] } }).lean();
  const allCameras = [...soldCameras, ...readyCameras];
  const defectCount = allCameras.filter((cam) => cameraHasDefect(cam)).length;
  const defectRatePct = pct(defectCount, allCameras.length);

  const defectSamples = allCameras
    .filter((cam) => cameraHasDefect(cam))
    .slice(0, 5)
    .map((cam) => ({
      model: cam.model_name,
      code: cam.camera_code,
      note: cam.condition_note,
      status: cam.status,
      defect_tags: cam.defect_tags || [],
      true_cost: computeTrueCost(cam),
    }));

  const cameraOps = await getRepairOpsSummary();
  const { getOpsSummary: getCustomerRepairOpsSummary } = require('./customerRepairService');
  const customerRepairOps = await getCustomerRepairOpsSummary();

  return {
    defectRate: {
      ratePct: defectRatePct,
      defectCount,
      totalUnits: allCameras.length,
      samples: defectSamples,
      note: 'Theo has_defect, defect_tags và condition_grade — có module phiếu sửa.',
    },
    cameraOps,
    customerRepairOps,
  };
}

async function buildDashboardAnalytics(period = 'month', rangeOptions = {}) {
  const { start, end } = getDateRange(period, rangeOptions.start, rangeOptions.end);
  const chartPeriod = getChartGranularity(start, end);
  const [sales, inventory, customers, market] = await Promise.all([
    getSalesPerformance(start, end, chartPeriod),
    getInventorySupplyChain(),
    getCustomerAnalytics(start, end),
    getMarketTrends(start, end, chartPeriod),
  ]);

  return {
    period,
    chartPeriod,
    range: { start: start.toISOString(), end: end.toISOString() },
    sales,
    inventory,
    customers,
    market,
    dataNotes: [
      'Ống kính (Lens) nhận diện qua tên sản phẩm — chưa có SKU lens riêng.',
      'Doanh thu lab từ paymentAmount trên phiếu film.',
      'Vốn máy ảnh = giá mua + tổng phiếu sửa (true cost).',
    ],
  };
}

module.exports = { buildDashboardAnalytics, getDateRange, getRepairOpsMarket };
