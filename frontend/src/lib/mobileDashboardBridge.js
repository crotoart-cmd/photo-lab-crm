/**
 * Dashboard trên mobile: hiện local/cache ngay, refresh server nền.
 */
import api from '../api/client';
import { isMobileDataEnabled, loadSales } from './mobileLocalDb';
import { backupApi } from './mobileServerLink';
import {
  buildLocalRepairOpsMarket,
  mergeCustomerRepairsFromServer,
} from './mobileRepairLocal';
import { getLocalSummary } from './mobileRetailLocal';
import {
  resolvePeriodRange,
  getChartGranularity,
  toAnalyticsParams,
  periodCacheKey,
} from '../utils/periodRange';

const CACHE_KEY = 'nuocleo_dashboard_cache';
const CACHE_VERSION = 2;
const MOBILE_DASHBOARD_TIMEOUT_MS = 1200;
const MOBILE_ANALYTICS_TIMEOUT_MS = 8000;
const MOBILE_REPAIR_OPS_TIMEOUT_MS = 8000;

function shouldUseOfflineFallback(err) {
  if (!err?.response) return true;
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') return true;
  const status = err.response?.status;
  if (status === 401 && isMobileDataEnabled()) return true;
  return status >= 502 && status <= 504;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (data.version !== CACHE_VERSION) return {};
    return data;
  } catch {
    return {};
  }
}

function writeCache(patch) {
  const prev = readCache();
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ...prev, ...patch, version: CACHE_VERSION }));
}

/** Sau khi nạp đơn demo local — xoá analytics cache để biểu đồ tính lại từ máy. */
export function invalidateLocalDashboardCharts() {
  if (!isMobileDataEnabled()) return;
  writeCache({
    analyticsByPeriod: {},
    today: null,
    monthly: null,
    todayAt: 0,
    monthlyAt: 0,
  });
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function num(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function salesToday() {
  const start = startOfDay();
  return loadSales().filter((s) => new Date(s.sold_at || s.createdAt) >= start);
}

function salesThisMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return loadSales().filter((s) => new Date(s.sold_at || s.createdAt) >= start);
}

const LENS_NAME_RE = /lens|ống kính|nikkor|zeiss|summicron|planar|canon fd|pentax|minolta md/i;

function classifySaleSegment(sale) {
  if (sale.product_group === 'film' || sale.product_group === 'battery') return 'film_supplies';
  if (sale.product_group === 'camera') {
    const name = String(sale.name || sale.item_name || '').toLowerCase();
    if (LENS_NAME_RE.test(name)) return 'lens';
    return 'body';
  }
  return 'film_supplies';
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function getCachedMarketFromAnalytics() {
  const map = readCache().analyticsByPeriod || {};
  for (const entry of Object.values(map)) {
    if (entry?.market?.customerRepairOps || entry?.market?.cameraOps) return entry.market;
  }
  return null;
}

function getCachedRepairOps() {
  if (isMobileDataEnabled()) {
    return buildLocalRepairOpsMarket();
  }
  const cache = readCache();
  if (cache.repairOps) return cache.repairOps;
  return getCachedMarketFromAnalytics();
}

/** Gắn market (sửa chữa) vào analytics local/cache — RepairOpsPanel cần field này. */
export function withCachedMarket(analytics) {
  if (!analytics) return analytics;
  const hasRepair =
    analytics.market?.customerRepairOps ||
    analytics.market?.cameraOps ||
    analytics.market?.defectRate;
  if (hasRepair) return analytics;
  const repair = getCachedRepairOps();
  if (!repair) return analytics;
  return { ...analytics, market: { ...(analytics.market || {}), ...repair } };
}

/** API repair ops — mobile: luôn từ máy; Mac chỉ merge backup nền. */
export async function fetchRepairOpsMarket() {
  if (!isMobileDataEnabled()) {
    const { data } = await api.get('/dashboard/repair-ops');
    return data;
  }

  const local = buildLocalRepairOpsMarket();

  if (!navigator.onLine) return local;

  try {
    const viaBackup = await backupApi({
      url: '/dashboard/repair-ops',
      method: 'GET',
      timeout: MOBILE_REPAIR_OPS_TIMEOUT_MS,
    });
    const server = viaBackup?.data
      ? viaBackup.data
      : (await api.get('/dashboard/repair-ops', { timeout: MOBILE_REPAIR_OPS_TIMEOUT_MS })).data;

    if (server?.customerRepairOps?.pipeline?.length) {
      mergeCustomerRepairsFromServer(server.customerRepairOps.pipeline);
    }
    writeCache({ repairOps: server, repairOpsAt: Date.now() });
  } catch {
    /* Mac không tới — vẫn dùng local */
  }

  return buildLocalRepairOpsMarket();
}

function mergeMarketIntoAnalytics(analytics, market) {
  if (!analytics || !market) return analytics;
  return { ...analytics, market: { ...(analytics.market || {}), ...market } };
}

export { mergeMarketIntoAnalytics };

function buildOrderBucketsDay() {
  return Array.from({ length: 24 }, (_, hour) => ({
    key: `h${hour}`,
    label: `${String(hour).padStart(2, '0')}h`,
  }));
}

function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

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

function buildOrderBucketsPeriod(period, start, end) {
  if (period === 'day') return buildOrderBucketsDay();
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

function buildLocalOrderSeries(sales, period, start, end) {
  const buckets = buildOrderBucketsPeriod(period, start, end);
  const map = Object.fromEntries(buckets.map((b) => [b.key, { orders: 0, revenue: 0 }]));

  for (const sale of sales) {
    const key = orderBucketKey(new Date(sale.sold_at || sale.createdAt), period);
    if (!map[key]) continue;
    map[key].orders += 1;
    map[key].revenue += num(sale.total_amount);
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
    totalRevenue: sales.reduce((sum, s) => sum + num(s.total_amount), 0),
  };
}

function normalizeSelection(selection) {
  if (typeof selection === 'string') return { id: selection };
  return selection || { id: 'month' };
}

function salesInRange(start, end) {
  return loadSales().filter((s) => {
    const d = new Date(s.sold_at || s.createdAt);
    return d >= start && d <= end;
  });
}

function buildLocalPeriodAnalytics(selection = { id: 'day' }) {
  const sel = normalizeSelection(selection);
  const { start, end, id } = resolvePeriodRange(sel);
  const chartPeriod = getChartGranularity(start, end);
  const periodSales = salesInRange(start, end);
  let revenue = 0;
  let cost = 0;
  let profit = 0;
  const segments = { body: 0, lens: 0, film_supplies: 0 };
  const productMap = {};

  for (const sale of periodSales) {
    const amount = num(sale.total_amount);
    revenue += amount;
    cost += num(sale.total_cost);
    profit += sale.profit != null ? num(sale.profit) : amount - num(sale.total_cost);
    segments[classifySaleSegment(sale)] += amount;

    const key = `${sale.product_group}:${sale.code}`;
    if (!productMap[key]) {
      productMap[key] = {
        name: sale.name || sale.item_name,
        code: sale.code,
        product_group: sale.product_group,
        quantity: 0,
        revenue: 0,
      };
    }
    productMap[key].quantity += num(sale.quantity, 1);
    productMap[key].revenue += amount;
  }

  const segmentTotal = segments.body + segments.lens + segments.film_supplies;
  const orderCount = periodSales.length;

  return {
    period: id,
    chartPeriod,
    range: { start: start.toISOString(), end: end.toISOString() },
    sales: {
      revenue,
      cost,
      profit,
      grossMarginPct: pct(profit, revenue),
      orderCount,
      aov: orderCount ? Math.round(revenue / orderCount) : 0,
      orderSeries: buildLocalOrderSeries(periodSales, chartPeriod, start, end),
      segments: {
        body: { revenue: segments.body, sharePct: pct(segments.body, segmentTotal) },
        lens: { revenue: segments.lens, sharePct: pct(segments.lens, segmentTotal) },
        film_supplies: {
          revenue: segments.film_supplies,
          sharePct: pct(segments.film_supplies, segmentTotal),
        },
      },
      topProducts: Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8),
    },
    _fromDevice: true,
  };
}

/** Phân tích bán lẻ trong ngày — dùng cho biểu đồ tab Cửa hàng (offline). */
export function buildLocalDayAnalytics() {
  return buildLocalPeriodAnalytics('day');
}

/** Gộp tồn kho & bán hôm nay từ máy — POS lưu local, không bị server 0 đè. */
export function mergeLocalRetailIntoToday(today) {
  if (!isMobileDataEnabled()) return today;
  const local = buildLocalDashboardToday();
  const localRetail = local.retail;
  const serverRetail = today?.retail || {};

  const retail = {
    ...serverRetail,
    filmBatches: localRetail.filmBatches,
    batterySkus: localRetail.batterySkus,
    cameraReady: localRetail.cameraReady,
    cameraSold: localRetail.cameraSold,
    salesToday: localRetail.salesToday,
    revenueToday: localRetail.revenueToday,
    recentSales: localRetail.recentSales?.length
      ? localRetail.recentSales
      : serverRetail.recentSales || [],
  };

  return {
    ...(today || local),
    date: today?.date || local.date,
    films: today?.films ?? local.films,
    retail,
    customers: today?.customers ?? local.customers,
    inventory: today?.inventory ?? local.inventory,
    _localRetail: localRetail,
  };
}

/** Ưu tiên số liệu bán lẻ trên máy cho biểu đồ ngày. */
export function mergeLocalDayAnalytics(serverAnalytics) {
  const local = buildLocalDayAnalytics();
  if (!serverAnalytics?.sales) return local;
  const localOrders = local.sales?.orderCount || 0;
  const serverOrders = serverAnalytics.sales?.orderCount || 0;
  if (localOrders >= serverOrders && localOrders > 0) {
    return {
      ...serverAnalytics,
      period: 'day',
      sales: {
        ...serverAnalytics.sales,
        ...local.sales,
      },
      _fromDevice: true,
    };
  }
  if (localOrders > 0 && serverOrders === 0) {
    return { ...local, market: serverAnalytics.market, customers: serverAnalytics.customers };
  }
  return serverAnalytics;
}

export function buildLocalDashboardToday() {
  const today = new Date().toISOString().split('T')[0];
  const todaySales = salesToday();
  const revenue = todaySales.reduce((s, x) => s + num(x.total_amount), 0);
  const summary = getLocalSummary();

  const retail = {
    filmBatches: summary.filmBatches,
    batterySkus: summary.batterySkus,
    cameraReady: summary.cameraReady,
    cameraSold: summary.cameraSold,
    salesToday: todaySales.length,
    revenueToday: revenue,
    recentSales: todaySales.slice(0, 5).map((s) => ({
      code: s.code,
      name: s.name || s.item_name,
      amount: num(s.total_amount),
      product_group: s.product_group,
    })),
  };

  return {
    date: today,
    films: {
      receivedToday: 0,
      processing: 0,
      completed: 0,
      deliveredToday: 0,
      waitingPickup: 0,
      readyForPickup: 0,
    },
    retail,
    customers: { active: 0 },
    inventory: {
      byCategory: [],
      lowStockCount: 0,
      lowStockItems: [],
      chemicalWarnings: [],
    },
    _localRetail: retail,
    _fromDevice: true,
  };
}

export function buildLocalDashboardMonthly() {
  const now = new Date();
  const monthSales = salesThisMonth();
  const revenue = monthSales.reduce((s, x) => s + num(x.total_amount), 0);

  return {
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    totalReceived: 0,
    totalDelivered: 0,
    statusBreakdown: {},
    _localRetail: {
      salesCount: monthSales.length,
      revenue,
    },
    _fromDevice: true,
  };
}

function worstSource(todaySource, monthlySource) {
  if (todaySource === 'device' || monthlySource === 'device') return 'device';
  if (todaySource === 'cache' || monthlySource === 'cache') return 'cache';
  return 'server';
}

/** Snapshot khởi tạo Dashboard mobile — không throw, không chờ mạng. */
export function bootstrapMobileDashboard(selection = { id: 'month' }) {
  try {
    const snap = getDashboardLocalSnapshot(selection);
    if (snap?.today) return snap;
  } catch (err) {
    console.warn('[Dashboard] local snapshot failed', err);
  }
  try {
    return {
      today: buildLocalDashboardToday(),
      monthly: buildLocalDashboardMonthly(),
      analytics: withCachedMarket({
        ...buildLocalPeriodAnalytics(normalizeSelection(selection)),
        market: buildLocalRepairOpsMarket(),
      }),
      source: 'device',
      cachedAt: null,
    };
  } catch (err) {
    console.warn('[Dashboard] local fallback failed', err);
    const today = buildLocalDashboardToday();
    return {
      today,
      monthly: { month: new Date().toISOString().slice(0, 7), totalReceived: 0, totalDelivered: 0 },
      analytics: null,
      source: 'device',
      cachedAt: null,
    };
  }
}

/** Đọc ngay từ máy — không chờ mạng. */
export function getDashboardLocalSnapshot(selection = { id: 'month' }) {
  if (!isMobileDataEnabled()) return null;

  const sel = normalizeSelection(selection);
  const key = periodCacheKey(sel);
  const cache = readCache();
  const todaySource = cache.today ? 'cache' : 'device';
  const monthlySource = cache.monthly ? 'cache' : 'device';
  const cachedAt = Math.max(cache.todayAt || 0, cache.monthlyAt || 0) || null;

  const cachedAnalytics = cache.analyticsByPeriod?.[key];

  return {
    today: mergeLocalRetailIntoToday(cache.today || buildLocalDashboardToday()),
    monthly: cache.monthly || buildLocalDashboardMonthly(),
    analytics:
      key === 'day'
        ? withCachedMarket(mergeLocalDayAnalytics(cachedAnalytics))
        : withCachedMarket(cachedAnalytics || buildLocalPeriodAnalytics(sel)),
    source: worstSource(todaySource, monthlySource),
    cachedAt,
  };
}

/** Refresh server nền — không chặn UI. */
export async function refreshDashboardInBackground(selection = { id: 'month' }) {
  if (!isMobileDataEnabled() || !navigator.onLine) return null;

  const sel = normalizeSelection(selection);
  const params = toAnalyticsParams(sel);
  const key = periodCacheKey(sel);
  const timeout = { timeout: MOBILE_DASHBOARD_TIMEOUT_MS };

  try {
    const [todayRes, monthlyRes] = await Promise.all([
      api.get('/dashboard/today', timeout),
      api.get('/dashboard/monthly', timeout),
    ]);

    const now = Date.now();
    const mergedToday = mergeLocalRetailIntoToday(todayRes.data);
    writeCache({
      today: mergedToday,
      todayAt: now,
      monthly: monthlyRes.data,
      monthlyAt: now,
    });

    let analytics = null;
    const analyticsMap = { ...(readCache().analyticsByPeriod || {}) };
    const fetchKeys = [...new Set(['day', key])];
    for (const cacheKey of fetchKeys) {
      try {
        const requestParams = cacheKey === key ? params : { period: 'day' };
        const { data } = await api.get('/dashboard/analytics', {
          params: requestParams,
          timeout: MOBILE_ANALYTICS_TIMEOUT_MS,
        });
        analyticsMap[cacheKey] =
          cacheKey === 'day'
            ? withCachedMarket(mergeLocalDayAnalytics(data))
            : withCachedMarket(data);
        if (cacheKey === key) analytics = analyticsMap[cacheKey];
      } catch {
        /* analytics optional per period */
      }
    }
    if (Object.keys(analyticsMap).length) {
      writeCache({
        analyticsByPeriod: analyticsMap,
        analytics_dayAt: Date.now(),
        [`analytics_${key}At`]: Date.now(),
      });
    }

    let repairOps = buildLocalRepairOpsMarket();
    try {
      const synced = await fetchRepairOpsMarket();
      if (synced) repairOps = synced;
    } catch {
      /* giữ local */
    }

    return {
      today: mergedToday,
      monthly: monthlyRes.data,
      analytics: analytics
        ? { ...analytics, market: { ...(analytics.market || {}), ...repairOps } }
        : null,
      source: 'server',
      cachedAt: now,
    };
  } catch (err) {
    if (!shouldUseOfflineFallback(err)) throw err;
    return null;
  }
}

async function fetchWithCache(endpoint, cacheField, buildLocal, params) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.get(endpoint, params ? { params } : undefined);
    return { data, source: 'server' };
  }

  const cache = readCache();
  const instant = {
    data: cache[cacheField] || buildLocal(),
    source: cache[cacheField] ? 'cache' : 'device',
    cachedAt: cache[`${cacheField}At`],
  };

  if (!navigator.onLine) return instant;

  try {
    const requestConfig = {
      ...(params ? { params } : {}),
      timeout: MOBILE_DASHBOARD_TIMEOUT_MS,
    };
    const { data } = await api.get(endpoint, requestConfig);
    const atField = `${cacheField}At`;
    writeCache({ [cacheField]: data, [atField]: Date.now() });
    return { data, source: 'server' };
  } catch (err) {
    if (!shouldUseOfflineFallback(err)) throw err;
    return instant;
  }
}

export async function fetchDashboardToday() {
  return fetchWithCache('/dashboard/today', 'today', buildLocalDashboardToday);
}

export async function fetchDashboardMonthly() {
  return fetchWithCache('/dashboard/monthly', 'monthly', buildLocalDashboardMonthly);
}

export async function fetchDashboardAnalytics(selection) {
  const sel = normalizeSelection(selection);
  const params = toAnalyticsParams(sel);
  const cacheKey = periodCacheKey(sel);
  const cacheField = `analytics_${cacheKey}`;

  if (!isMobileDataEnabled()) {
    const { data } = await api.get('/dashboard/analytics', { params });
    return { data, source: 'server' };
  }

  const cache = readCache();
  const cached = cache.analyticsByPeriod?.[cacheKey];
  const localFallback = () =>
    cacheKey === 'day' ? mergeLocalDayAnalytics(null) : buildLocalPeriodAnalytics(sel);
  const instant = cached
    ? {
        data: withCachedMarket(
          cacheKey === 'day' ? mergeLocalDayAnalytics(cached) : cached
        ),
        source: 'cache',
        cachedAt: cache[`${cacheField}At`],
      }
    : { data: withCachedMarket(localFallback()), source: 'device' };

  if (!navigator.onLine) return instant;

  try {
    const { data } = await api.get('/dashboard/analytics', {
      params,
      timeout: MOBILE_ANALYTICS_TIMEOUT_MS,
    });
    const merged = withCachedMarket(
      cacheKey === 'day' ? mergeLocalDayAnalytics(data) : data
    );
    const analyticsMap = cache.analyticsByPeriod || {};
    analyticsMap[cacheKey] = merged;
    writeCache({
      analyticsByPeriod: analyticsMap,
      [`${cacheField}At`]: Date.now(),
    });
    return { data: merged, source: 'server' };
  } catch (err) {
    if (!shouldUseOfflineFallback(err)) throw err;
    return instant;
  }
}

export async function refreshDashboardFromServer() {
  const updated = await refreshDashboardInBackground('month');
  return Boolean(updated);
}

export function getDashboardCacheAge() {
  const cache = readCache();
  const ts = Math.max(cache.todayAt || 0, cache.monthlyAt || 0);
  return ts || null;
}
