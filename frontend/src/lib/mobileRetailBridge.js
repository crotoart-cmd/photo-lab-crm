/**
 * Mobile: điện thoại là nguồn chính — bán/nhập trên máy trước, Mac chỉ backup.
 */
import api from '../api/client';
import {
  isMobileDataEnabled,
  pushSyncQueue,
  newLocalId,
  getPendingSyncCount,
  loadSyncQueue,
  removeSyncQueue,
} from './mobileLocalDb';
import { notifyRetailDataChanged } from './seedTestCameras';
import {
  confirmIntakeLocal,
  checkSaleLocal,
  resolveScanCode,
  getLocalRetailSnapshot,
  cacheServerRetailData,
} from './mobileRetailLocal';
import { trySyncCustomerQueueItem, resolveCustomerIdForServer } from './mobileCustomerBridge';
import { isLocalCustomerId, getServerCustomerId } from './mobileCustomerLocal';
import {
  backupApi,
  hasBackupSession,
  MSG_DEVICE_SAVED,
  MSG_BACKUP_PENDING,
  MSG_EMAIL_PENDING,
} from './mobileServerLink';
import { sendSaleReceiptFromDevice, isDeviceSmtpConfigured } from './mobileDeviceEmail';
import { normalizeCheckoutEmail, isValidCheckoutEmail } from '../utils/checkoutBuyer';
import { ensureLocalTestCameras } from './seedTestCameras';

export { isMobileDataEnabled, getPendingSyncCount };

const SYNC_PRIORITY = {
  'customer-create': 0,
  'customer-update': 1,
  'repair-create': 2,
  'repair-quote': 3,
  'repair-confirm': 3,
  'repair-work-log': 3,
  'repair-ready': 3,
  'repair-return': 3,
  'repair-cancel': 3,
  'film-receive': 4,
  'film-status': 5,
  'film-batch': 5,
  'inventory-upsert': 4,
  'inventory-adjust': 5,
  intake: 6,
  sale: 7,
  'checkout-cart': 8,
};

function sortSyncQueue(queue) {
  return [...queue].sort(
    (a, b) => (SYNC_PRIORITY[a.type] ?? 9) - (SYNC_PRIORITY[b.type] ?? 9)
  );
}

function prepareRetailPayloadForServer(payload) {
  const next = { ...payload };
  if (next.customerId) {
    const resolved = resolveCustomerIdForServer(next.customerId);
    if (resolved) next.customerId = resolved;
    else if (isLocalCustomerId(next.customerId)) delete next.customerId;
  }
  return next;
}

function shouldTreatAsUnreachable(err) {
  if (!err?.response) return true;
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') return true;
  const status = err.response?.status;
  if (status === 401) return true;
  return status >= 502 && status <= 504;
}

function buyerEmailLikely(payload) {
  return isValidCheckoutEmail(payload.customer_email);
}

async function tryServerSync(queueItem) {
  if (!hasBackupSession()) return { synced: false };

  try {
    if (queueItem.type === 'customer-create' || queueItem.type === 'customer-update') {
      const result = await trySyncCustomerQueueItem(queueItem);
      if (result.synced) removeSyncQueue(queueItem.id);
      return result;
    }

    if (String(queueItem.type || '').startsWith('repair-')) {
      const { trySyncRepairQueueItem } = await import('./mobileRepairBridge');
      const result = await trySyncRepairQueueItem(queueItem);
      if (result.synced) removeSyncQueue(queueItem.id);
      return result;
    }

    if (String(queueItem.type || '').startsWith('film-')) {
      const { trySyncFilmQueueItem } = await import('./mobileFilmLabBridge');
      const result = await trySyncFilmQueueItem(queueItem);
      if (result.synced) removeSyncQueue(queueItem.id);
      return result;
    }

    if (String(queueItem.type || '').startsWith('inventory-')) {
      const { trySyncInventoryQueueItem } = await import('./mobileInventoryBridge');
      const result = await trySyncInventoryQueueItem(queueItem);
      if (result.synced) removeSyncQueue(queueItem.id);
      return result;
    }

    if (queueItem.type === 'intake') {
      const res = await backupApi({
        method: 'post',
        url: '/retail/smart-intake/confirm',
        data: queueItem.payload,
      });
      if (!res) return { synced: false };
      removeSyncQueue(queueItem.id);
      return { synced: true };
    }

    if (queueItem.type === 'checkout-cart') {
      const payload = prepareRetailPayloadForServer(queueItem.payload);
      if (queueItem.payload.customerId && isLocalCustomerId(queueItem.payload.customerId) && !payload.customerId) {
        return { synced: false };
      }
      const res = await backupApi({
        method: 'post',
        url: '/retail/checkout-cart',
        data: payload,
        timeout: 20000,
      });
      if (!res) return { synced: false };
      removeSyncQueue(queueItem.id);
      return { synced: true, data: res.data };
    }

    if (queueItem.type === 'sale') {
      const payload = prepareRetailPayloadForServer(queueItem.payload);
      if (queueItem.payload.customerId && isLocalCustomerId(queueItem.payload.customerId) && !payload.customerId) {
        return { synced: false };
      }
      const res = await backupApi({
        method: 'post',
        url: '/retail/check-sale',
        data: payload,
      });
      if (!res) return { synced: false };
      removeSyncQueue(queueItem.id);
      return { synced: true, data: res.data };
    }

    return { synced: false };
  } catch (err) {
    if (shouldTreatAsUnreachable(err)) return { synced: false };
    throw err;
  }
}

function queueForBackup(type, payload) {
  const item = { id: newLocalId(), type, payload };
  pushSyncQueue(item);
  tryServerSync(item)
    .then((r) => {
      if (r.synced) import('./mobileSync').then((m) => m.runAutoSync('after-action'));
    })
    .catch(() => {});
  return item;
}

/** Đẩy khách local lên Mac trước khi checkout (để gửi email đúng khách). */
async function ensureCustomerOnServer(customerId) {
  if (!customerId || !isLocalCustomerId(customerId)) return true;
  if (getServerCustomerId(customerId)) return true;

  const pending = loadSyncQueue().filter(
    (q) => q.type === 'customer-create' && q.payload?.localId === customerId
  );
  for (const item of pending) {
    const result = await trySyncCustomerQueueItem(item);
    if (result.synced) removeSyncQueue(item.id);
  }
  return Boolean(getServerCustomerId(customerId));
}

async function pushCheckoutToServer(payload) {
  if (!hasBackupSession()) return { ok: false, reason: 'no-session' };

  if (payload.customerId) {
    await ensureCustomerOnServer(payload.customerId);
  }

  const prepared = prepareRetailPayloadForServer(payload);
  if (payload.customerId && isLocalCustomerId(payload.customerId) && !prepared.customerId) {
    if (!prepared.customer_email && !prepared.customer_name) {
      return { ok: false, reason: 'customer-pending' };
    }
    delete prepared.customerId;
  }

  try {
    const res = await backupApi({
      method: 'post',
      url: '/retail/checkout-cart',
      data: prepared,
      timeout: 25000,
    });
    if (!res?.data) return { ok: false, reason: 'unreachable' };
    return { ok: true, data: res.data };
  } catch (err) {
    if (shouldTreatAsUnreachable(err)) return { ok: false, reason: 'unreachable' };
    return {
      ok: false,
      reason: 'server-error',
      message: err.response?.data?.message || err.message,
      partial: err.response?.data,
    };
  }
}

export async function confirmIntake(payload) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post('/retail/smart-intake/confirm', payload);
    return { data, savedOnDevice: false, synced: true };
  }

  const localResult = confirmIntakeLocal(payload);
  queueForBackup('intake', payload);
  notifyRetailDataChanged();

  return {
    data: localResult,
    savedOnDevice: true,
    synced: false,
  };
}

export async function scanSale(code) {
  if (isMobileDataEnabled()) {
    const local = resolveScanCode(code);
    if (local) return { data: { item: local } };
  }
  try {
    const { data } = await api.post('/retail/smart-sale/scan', { code });
    return { data };
  } catch (err) {
    if (isMobileDataEnabled()) {
      const local = resolveScanCode(code);
      if (local) return { data: { item: local } };
      if (shouldTreatAsUnreachable(err)) {
        throw new Error('Không có trong tồn kho máy — nhập hàng trên máy trước');
      }
    }
    throw err;
  }
}

async function pushSaleToServer(payload) {
  if (!hasBackupSession()) return { ok: false, reason: 'no-session' };

  if (payload.customerId) {
    await ensureCustomerOnServer(payload.customerId);
  }

  const prepared = prepareRetailPayloadForServer(payload);
  if (payload.customerId && isLocalCustomerId(payload.customerId) && !prepared.customerId) {
    if (!prepared.customer_email && !prepared.customer_name) {
      return { ok: false, reason: 'customer-pending' };
    }
    delete prepared.customerId;
  }

  try {
    const res = await backupApi({
      method: 'post',
      url: '/retail/check-sale',
      data: prepared,
      timeout: 25000,
    });
    if (!res?.data) return { ok: false, reason: 'unreachable' };
    return { ok: true, data: res.data };
  } catch (err) {
    if (shouldTreatAsUnreachable(err)) return { ok: false, reason: 'unreachable' };
    return {
      ok: false,
      reason: 'server-error',
      message: err.response?.data?.message || err.message,
      partial: err.response?.data,
    };
  }
}

/**
 * Gửi phiếu bán từ iPhone (SMTP) hoặc Mac backup — dùng chung cho giỏ hàng & bán lẻ đơn.
 */
async function resolveMobileSaleEmailAfterLocal(payload, log, profit, queueType, queuePayload) {
  const deviceConfigured = await isDeviceSmtpConfigured();
  const hasBuyerEmail = buyerEmailLikely(payload);
  const deviceEmail = hasBuyerEmail
    ? await sendSaleReceiptFromDevice({ payload, log })
    : { sent: false, skipped: true, reason: 'no-email' };

  if (deviceEmail.sent) {
    return {
      emailSent: true,
      emailSentTo: deviceEmail.to || normalizeCheckoutEmail(payload.customer_email),
      synced: false,
    };
  }

  if (deviceConfigured && !hasBuyerEmail) {
    return {
      emailSkipped: true,
      emailSkippedReason: 'no-buyer-email',
      synced: false,
    };
  }

  const pushToServer = queueType === 'sale' ? pushSaleToServer : pushCheckoutToServer;

  if (!deviceConfigured) {
    const serverPush = await pushToServer(queuePayload);

    if (serverPush.ok) {
      const sd = serverPush.data;
      return {
        emailSent: sd.emailSent,
        emailSentTo: sd.emailSentTo,
        emailSkipped: sd.emailSkipped,
        emailError: sd.emailError,
        serverMessage: sd.message,
        serverLog: sd.log,
        serverProfit: sd.profit ?? profit,
        synced: true,
      };
    }

    queueForBackup(queueType, queuePayload);

    const wantsEmail = buyerEmailLikely(payload);
    let backupNote = MSG_BACKUP_PENDING;
    if (wantsEmail && serverPush.reason === 'unreachable') {
      backupNote = `${MSG_EMAIL_PENDING} — ${MSG_BACKUP_PENDING}`;
    } else if (serverPush.reason === 'server-error' && serverPush.message) {
      backupNote = `Mac: ${serverPush.message} — ${MSG_BACKUP_PENDING}`;
    }

    return {
      emailPending: wantsEmail && !serverPush.ok,
      emailSkipped: wantsEmail && serverPush.reason === 'no-session',
      serverSyncError: serverPush.message || null,
      backupNote,
      serverLog: serverPush.partial?.log,
      synced: false,
    };
  }

  const serverPush = await pushToServer(queuePayload);
  if (serverPush.ok && serverPush.data?.emailSent) {
    const sd = serverPush.data;
    return {
      emailSent: true,
      emailSentTo: sd.emailSentTo || normalizeCheckoutEmail(payload.customer_email),
      emailError: deviceEmail.error || null,
      serverMessage: sd.message,
      serverLog: sd.log,
      serverProfit: sd.profit ?? profit,
      synced: true,
    };
  }

  queueForBackup(queueType, queuePayload);

  return {
    emailError: deviceEmail.error || 'Gửi email từ máy thất bại',
    emailPending: buyerEmailLikely(payload) && !serverPush.ok,
    serverSyncError: serverPush.message || null,
    synced: false,
  };
}

export async function checkoutCart(payload) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post('/retail/checkout-cart', payload);
    return { data, savedOnDevice: false, synced: true };
  }

  const saleMeta = {
    customerId: payload.customerId,
    customer_name: payload.customer_name,
    customer_email: payload.customer_email,
  };

  const log = [];
  for (const item of payload.items || []) {
    const localResult = checkSaleLocal({ ...item, ...saleMeta });
    log.push({
      name: item.name || item.code,
      qty: item.quantity,
      sale_code: localResult.sale.sale_code,
      revenue: localResult.sale.total_amount,
      profit: localResult.profit,
      ok: true,
    });
  }

  const profit = log.reduce((s, r) => s + (r.profit || 0), 0);

  const emailMeta = await resolveMobileSaleEmailAfterLocal(
    payload,
    log,
    profit,
    'checkout-cart',
    payload
  );

  if (emailMeta.backupNote) {
    return {
      data: {
        message: `${MSG_DEVICE_SAVED} — ${emailMeta.backupNote}`,
        log: emailMeta.serverLog || log,
        profit,
        emailPending: emailMeta.emailPending,
        emailSkipped: emailMeta.emailSkipped,
        serverSyncError: emailMeta.serverSyncError,
      },
      savedOnDevice: true,
      synced: false,
    };
  }

  return {
    data: {
      message: emailMeta.serverMessage || MSG_DEVICE_SAVED,
      log: emailMeta.serverLog || log,
      profit: emailMeta.serverProfit ?? profit,
      emailSent: emailMeta.emailSent,
      emailSentTo: emailMeta.emailSentTo,
      emailSkipped: emailMeta.emailSkipped,
      emailSkippedReason: emailMeta.emailSkippedReason,
      emailError: emailMeta.emailError,
      emailPending: emailMeta.emailPending,
      serverSyncError: emailMeta.serverSyncError,
    },
    savedOnDevice: true,
    synced: Boolean(emailMeta.synced),
  };
}

export async function checkSale(payload) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post('/retail/check-sale', payload);
    return { data, savedOnDevice: false, synced: true };
  }

  const localResult = checkSaleLocal({ ...payload });
  const log = [
    {
      name: localResult.sale.name,
      qty: localResult.sale.quantity,
      sale_code: localResult.sale.sale_code,
      revenue: localResult.sale.total_amount,
      profit: localResult.profit,
      ok: true,
    },
  ];

  const emailPayload = {
    customerId: payload.customerId,
    customer_name: payload.customer_name,
    customer_email: payload.customer_email,
    items: [
      {
        product_group: payload.product_group,
        code: payload.code,
        quantity: payload.quantity,
        unit_price: payload.unit_price,
        camera_id: payload.camera_id,
        name: localResult.sale.name,
      },
    ],
  };

  const emailMeta = await resolveMobileSaleEmailAfterLocal(
    emailPayload,
    log,
    localResult.profit,
    'sale',
    payload
  );

  return {
    data: {
      sale: localResult.sale,
      profit: localResult.profit,
      log,
      message: emailMeta.serverMessage || MSG_DEVICE_SAVED,
      emailSent: emailMeta.emailSent,
      emailSentTo: emailMeta.emailSentTo,
      emailSkipped: emailMeta.emailSkipped,
      emailSkippedReason: emailMeta.emailSkippedReason,
      emailError: emailMeta.emailError,
      emailPending: emailMeta.emailPending,
      serverSyncError: emailMeta.serverSyncError,
    },
    savedOnDevice: true,
    synced: Boolean(emailMeta.synced),
  };
}

export async function loadRetailData() {
  if (!isMobileDataEnabled()) {
    return null;
  }

  ensureLocalTestCameras();
  const local = getLocalRetailSnapshot();
  refreshRetailFromServer().catch(() => {});
  return { ...local, fromDevice: true };
}

async function refreshRetailFromServer() {
  if (!hasBackupSession()) return { ...getLocalRetailSnapshot(), fromDevice: true };

  try {
    const timeout = { timeout: 1200 };
    const get = (url, params) =>
      backupApi({ method: 'get', url, params, ...timeout }).then((r) => r || { data: null });

    const [sumRes, salesRes, filmRes, batRes, camRes, skuRes] = await Promise.all([
      get('/retail/summary'),
      get('/retail/sales', { limit: 30 }),
      get('/retail/film-stock'),
      get('/retail/battery-stock'),
      get('/retail/camera-stock'),
      get('/retail/film-sku'),
    ]);

    if (!sumRes.data) return { ...getLocalRetailSnapshot(), fromDevice: true };

    const salesPayload = salesRes.data?.sales ?? salesRes.data ?? [];
    const sales = Array.isArray(salesPayload) ? salesPayload : [];

    if (getPendingSyncCount() === 0) {
      cacheServerRetailData({
        summary: sumRes.data,
        filmRows: filmRes.data,
        batteryRows: batRes.data,
        cameraRows: camRes.data,
        filmSkus: skuRes.data,
        batteries: batRes.data?.filter((b) => b.quantity > 0) || [],
        cameras: camRes.data?.filter((c) => c.status === 'San_Hang') || [],
        sales,
        salesTotals: salesRes.data?.totals ?? null,
      });
    }

    const merged = getLocalRetailSnapshot();
    return {
      summary: merged.summary,
      filmRows: merged.filmRows,
      batteryRows: merged.batteryRows,
      cameraRows: merged.cameraRows,
      filmSkus: skuRes.data?.length ? skuRes.data : merged.filmSkus,
      batteries: merged.batteries,
      cameras: merged.cameras,
      sales: merged.sales,
      salesTotals: salesRes.data?.totals || merged.salesTotals,
      fromDevice: true,
    };
  } catch {
    return { ...getLocalRetailSnapshot(), fromDevice: true };
  }
}

export function getRetailSnapshotInstant() {
  if (!isMobileDataEnabled()) return null;
  ensureLocalTestCameras();
  return { ...getLocalRetailSnapshot(), fromDevice: true };
}

export function refreshRetailDataInBackground() {
  return refreshRetailFromServer();
}

export async function syncPendingQueue() {
  const queue = sortSyncQueue(loadSyncQueue());
  let ok = 0;
  let fail = 0;
  let lastCheckoutEmail = null;

  for (const item of queue) {
    try {
      const result = await tryServerSync(item);
      if (result.synced) {
        ok += 1;
        if (result.data?.emailSent != null) {
          lastCheckoutEmail = {
            emailSent: result.data.emailSent,
            emailError: result.data.emailError,
            emailSkipped: result.data.emailSkipped,
          };
        }
      } else {
        fail += 1;
      }
    } catch {
      fail += 1;
    }
  }

  if (ok > 0) {
    try {
      await loadRetailData();
      const { loadEnrichedCustomers } = await import('./mobileCustomerBridge');
      await loadEnrichedCustomers();
    } catch {
      /* giữ dữ liệu máy */
    }
  }

  return { ok, fail, remaining: getPendingSyncCount(), lastCheckoutEmail };
}
