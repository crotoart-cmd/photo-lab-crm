/**
 * Lưu trữ cục bộ trên iPhone / app mobile (localStorage — persist qua lần mở app).
 */
import { isNativeApp } from '../config/apiBase';

const KEYS = {
  film: 'nuocleo_local_film_stock',
  battery: 'nuocleo_local_battery_stock',
  camera: 'nuocleo_local_camera_stock',
  sales: 'nuocleo_local_sales',
  syncQueue: 'nuocleo_local_sync_queue',
  customerRepairs: 'nuocleo_local_customer_repairs',
  labFilms: 'nuocleo_local_lab_films',
  inventory: 'nuocleo_local_inventory',
  inventoryLogs: 'nuocleo_local_inventory_logs',
  dashboardCache: 'nuocleo_dashboard_cache',
  storageSettings: 'nuocleo_storage_settings',
  backupSettings: 'nuocleo_backup_settings',
  backupMeta: 'nuocleo_backup_meta',
};

const DEFAULT_RETENTION_MONTHS = 12;

export function isMobileDataEnabled() {
  if (typeof window === 'undefined') return false;
  if (isNativeApp()) return true;
  if (import.meta.env.VITE_MOBILE_APP === 'true') return true;
  if (localStorage.getItem('nuocleo_offline_mode') === '1') return true;
  return new URLSearchParams(window.location.search).get('local') === '1';
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadFilmStock() {
  return read(KEYS.film);
}

export function saveFilmStock(rows) {
  write(KEYS.film, rows);
}

export function loadBatteryStock() {
  return read(KEYS.battery);
}

export function saveBatteryStock(rows) {
  write(KEYS.battery, rows);
}

export function loadCameraStock() {
  return read(KEYS.camera);
}

export function saveCameraStock(rows) {
  write(KEYS.camera, rows);
}

export function loadSales() {
  return read(KEYS.sales);
}

export function saveSales(rows) {
  write(KEYS.sales, rows);
}

export function loadCustomerRepairs() {
  return read(KEYS.customerRepairs);
}

export function saveCustomerRepairs(rows) {
  write(KEYS.customerRepairs, rows);
}

export function loadLabFilms() {
  return read(KEYS.labFilms);
}

export function saveLabFilms(rows) {
  write(KEYS.labFilms, rows);
}

export function loadInventory() {
  return read(KEYS.inventory);
}

export function saveInventory(rows) {
  write(KEYS.inventory, rows);
}

export function loadInventoryLogs() {
  return read(KEYS.inventoryLogs);
}

export function saveInventoryLogs(rows) {
  write(KEYS.inventoryLogs, rows);
}

export function loadSyncQueue() {
  return read(KEYS.syncQueue);
}

export function pushSyncQueue(item) {
  const q = loadSyncQueue();
  q.push({ ...item, queuedAt: new Date().toISOString() });
  write(KEYS.syncQueue, q);
}

export function removeSyncQueue(id) {
  write(
    KEYS.syncQueue,
    loadSyncQueue().filter((x) => x.id !== id)
  );
}

export function newLocalId() {
  return `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getPendingSyncCount() {
  return loadSyncQueue().length;
}

export function clearAllLocalData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

export function getStorageSettings() {
  try {
    const raw = localStorage.getItem(KEYS.storageSettings);
    const parsed = raw ? JSON.parse(raw) : {};
    const retentionMonths = Number(parsed.retentionMonths);
    return {
      retentionMonths:
        retentionMonths === 6 || retentionMonths === 12 || retentionMonths === 24
          ? retentionMonths
          : DEFAULT_RETENTION_MONTHS,
      autoPrune: parsed.autoPrune !== false,
    };
  } catch {
    return { retentionMonths: DEFAULT_RETENTION_MONTHS, autoPrune: true };
  }
}

export function saveStorageSettings(next) {
  const current = getStorageSettings();
  const retentionMonths = Number(next?.retentionMonths ?? current.retentionMonths);
  const normalized = {
    retentionMonths:
      retentionMonths === 6 || retentionMonths === 12 || retentionMonths === 24
        ? retentionMonths
        : current.retentionMonths,
    autoPrune: next?.autoPrune ?? current.autoPrune,
  };
  localStorage.setItem(KEYS.storageSettings, JSON.stringify(normalized));
  return normalized;
}

function monthsAgo(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.getTime();
}

function toTime(value) {
  const t = new Date(value || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function pruneLocalData({ retentionMonths } = {}) {
  const settings = getStorageSettings();
  const keepMonths = retentionMonths || settings.retentionMonths;
  const cutoff = monthsAgo(keepMonths);

  const salesBefore = loadSales();
  const salesAfter = salesBefore.filter((s) => {
    // Giữ bản local chưa sync để tránh mất dữ liệu.
    if (s?._local) return true;
    return toTime(s?.sold_at || s?.createdAt) >= cutoff;
  });
  if (salesAfter.length !== salesBefore.length) saveSales(salesAfter);

  const queueBefore = loadSyncQueue();
  const queueAfter = queueBefore.filter((q) => {
    const queued = toTime(q?.queuedAt);
    // Giữ tối đa 30 ngày cho hàng chờ để tránh phình dữ liệu.
    return queued === 0 || queued >= monthsAgo(1);
  });
  if (queueAfter.length !== queueBefore.length) {
    write(KEYS.syncQueue, queueAfter);
  }

  return {
    retentionMonths: keepMonths,
    removedSales: salesBefore.length - salesAfter.length,
    removedQueue: queueBefore.length - queueAfter.length,
    salesLeft: salesAfter.length,
    queueLeft: queueAfter.length,
  };
}

export function buildLocalBackupPayload() {
  let customers = [];
  let customerIdMap = {};
  try {
    const raw = localStorage.getItem('nuocleo_customers_enriched');
    customers = raw ? JSON.parse(raw).data || [] : [];
    customerIdMap = JSON.parse(localStorage.getItem('nuocleo_customer_id_map') || '{}');
  } catch {
    /* ignore */
  }

  return {
    exportedAt: new Date().toISOString(),
    storageSettings: getStorageSettings(),
    data: {
      filmStock: loadFilmStock(),
      batteryStock: loadBatteryStock(),
      cameraStock: loadCameraStock(),
      sales: loadSales(),
      syncQueue: loadSyncQueue(),
      dashboardCache: read(KEYS.dashboardCache),
      customers,
      customerIdMap,
      customerRepairs: loadCustomerRepairs(),
      labFilms: loadLabFilms(),
      inventory: loadInventory(),
      inventoryLogs: loadInventoryLogs(),
    },
  };
}

export function markBackupExported() {
  const prev = getBackupMeta();
  localStorage.setItem(
    KEYS.backupMeta,
    JSON.stringify({ ...prev, exportedAt: new Date().toISOString() })
  );
}

export function getBackupMeta() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.backupMeta) || '{}');
  } catch {
    return {};
  }
}

export function markBackupSynced(detail = {}) {
  const prev = getBackupMeta();
  localStorage.setItem(
    KEYS.backupMeta,
    JSON.stringify({
      ...prev,
      serverBackupAt: new Date().toISOString(),
      lastBackupReason: detail.reason || 'auto',
      serverBackupId: detail.id || prev.serverBackupId,
    })
  );
}

export function getBackupSettings() {
  try {
    const raw = localStorage.getItem(KEYS.backupSettings);
    const parsed = raw ? JSON.parse(raw) : {};
    const autoBackupHours = Number(parsed.autoBackupHours);
    return {
      autoBackupEnabled: parsed.autoBackupEnabled !== false,
      autoBackupHours: [6, 12, 24].includes(autoBackupHours) ? autoBackupHours : 24,
    };
  } catch {
    return { autoBackupEnabled: true, autoBackupHours: 24 };
  }
}

export function saveBackupSettings(next = {}) {
  const current = getBackupSettings();
  const autoBackupHours = Number(next.autoBackupHours ?? current.autoBackupHours);
  const merged = {
    autoBackupEnabled: next.autoBackupEnabled ?? current.autoBackupEnabled,
    autoBackupHours: [6, 12, 24].includes(autoBackupHours)
      ? autoBackupHours
      : current.autoBackupHours,
  };
  localStorage.setItem(KEYS.backupSettings, JSON.stringify(merged));
  return merged;
}
