import api from '../api/client';
import { isMobileDataEnabled } from './mobileLocalDb';
import { rankCustomers } from '../utils/customerSearchRank';
import { removeDiacritics, buildSearchKey } from '../utils/customerNormalize';
import {
  getCachedCustomersList,
  mergeServerCustomersWithLocalPending,
  saveCustomerLocal,
  upsertCustomerInCache,
  replaceCustomerIdInCache,
  setCustomerIdMapping,
  rewriteSyncQueueCustomerIds,
  queueCustomerSync,
  getServerCustomerId,
  isLocalCustomerId,
  enrichCustomerRecord,
  findCustomerInCache,
} from './mobileCustomerLocal';
import {
  backupApi,
  hasBackupSession,
  MSG_DEVICE_SAVED,
  MSG_BACKUP_PENDING,
} from './mobileServerLink';

const CACHE_KEY = 'nuocleo_customers_enriched';
const CARE_KEY = 'nuocleo_customers_care';
const TIMEOUT_MS = 1200;

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  localStorage.setItem(key, JSON.stringify({ data, at: Date.now() }));
}

function shouldFallback(err) {
  if (!err?.response) return true;
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') return true;
  const status = err.response?.status;
  if (status === 401) return true;
  return status >= 502 && status <= 504;
}

export function getCachedEnrichedCustomers() {
  return getCachedCustomersList();
}

export function getCachedCareTasks() {
  const cached = readCache(CARE_KEY);
  return cached?.data || { inactive30d: [], readyPickup: [] };
}

export function searchCustomersLocal(query, customers = getCachedEnrichedCustomers()) {
  const q = removeDiacritics(query.trim());
  const qDigits = query.replace(/\D/g, '');
  if (!q && qDigits.length < 2) return customers.slice(0, 50);

  const filtered = customers.filter((c) => {
    const key = c.searchKey || buildSearchKey(c);
    if (q && key.includes(q)) return true;
    if (qDigits.length >= 2 && String(c.phone || '').includes(qDigits)) return true;
    return false;
  });

  return rankCustomers(query, filtered).slice(0, 25);
}

export async function loadEnrichedCustomers() {
  if (!isMobileDataEnabled()) {
    const { data } = await api.get('/customers/enriched');
    return { customers: data, source: 'server' };
  }

  const cached = getCachedEnrichedCustomers();
  if (cached.length) {
    if (hasBackupSession()) {
      backupApi({ method: 'get', url: '/customers/enriched', timeout: TIMEOUT_MS })
        .then((res) => {
          if (res?.data) writeCache(CACHE_KEY, mergeServerCustomersWithLocalPending(res.data));
        })
        .catch(() => {});
    }
    return { customers: cached, source: 'device' };
  }

  if (!hasBackupSession()) {
    return { customers: [], source: 'device' };
  }

  try {
    const res = await backupApi({ method: 'get', url: '/customers/enriched', timeout: TIMEOUT_MS });
    if (!res?.data) return { customers: [], source: 'device' };
    const merged = mergeServerCustomersWithLocalPending(res.data);
    writeCache(CACHE_KEY, merged);
    return { customers: merged, source: 'server' };
  } catch (err) {
    if (shouldFallback(err)) {
      try {
        const { data } = await api.get('/customers', { timeout: TIMEOUT_MS });
        const basic = data.map((c) =>
          enrichCustomerRecord({
            ...c,
            stats: {},
            tags: [],
            ltvGrade: 'C',
          })
        );
        if (basic.length) {
          const merged = mergeServerCustomersWithLocalPending(basic);
          writeCache(CACHE_KEY, merged);
          return { customers: merged, source: 'cache' };
        }
      } catch {
        /* ignore */
      }
      if (cached.length) return { customers: cached, source: 'cache' };
    }
    throw err;
  }
}

export async function loadCareTasks() {
  if (!isMobileDataEnabled()) {
    const { data } = await api.get('/customers/care-tasks');
    return data;
  }

  const cached = getCachedCareTasks();
  api
    .get('/customers/care-tasks', { timeout: TIMEOUT_MS })
    .then(({ data }) => writeCache(CARE_KEY, data))
    .catch(() => {});
  return cached;
}

export async function loadCustomerProfile(id) {
  const local = findCustomerInCache(id);
  if (isMobileDataEnabled() && local) {
    return { customer: local, timeline: [], stats: local.stats || {}, tags: local.tags || [] };
  }
  if (!hasBackupSession()) {
    if (local) {
      return { customer: local, timeline: [], stats: local.stats || {}, tags: local.tags || [] };
    }
    throw new Error('Không có dữ liệu khách trên máy');
  }
  try {
    const res = await backupApi({ method: 'get', url: `/customers/${id}/profile`, timeout: TIMEOUT_MS });
    return res?.data;
  } catch (err) {
    if (local) {
      return { customer: local, timeline: [], stats: local.stats || {}, tags: local.tags || [] };
    }
    throw err;
  }
}

export async function loadDuplicateGroups() {
  if (!isMobileDataEnabled()) {
    const { data } = await api.get('/customers/duplicates');
    return data;
  }
  if (!hasBackupSession()) return [];
  try {
    const res = await backupApi({ method: 'get', url: '/customers/duplicates', timeout: TIMEOUT_MS });
    return res?.data || [];
  } catch (err) {
    if (shouldFallback(err)) return [];
    throw err;
  }
}

export async function mergeCustomers(keepId, removeId) {
  const { data } = await api.post('/customers/merge', { keepId, removeId });
  const cached = getCachedEnrichedCustomers().filter((c) => c._id !== removeId);
  writeCache(CACHE_KEY, cached);
  return data;
}

/** Backup một mục khách trong hàng chờ lên Mac */
export async function trySyncCustomerQueueItem(queueItem) {
  if (!hasBackupSession()) return { synced: false };

  try {
    if (queueItem.type === 'customer-create') {
      const { localId, normalized } = queueItem.payload;
      const res = await backupApi({ method: 'post', url: '/customers', data: normalized });
      if (!res?.data?.customer) return { synced: false };
      const serverCustomer = res.data.customer;
      setCustomerIdMapping(localId, serverCustomer._id);
      replaceCustomerIdInCache(localId, serverCustomer);
      rewriteSyncQueueCustomerIds(localId, serverCustomer._id);
      return { synced: true, customer: serverCustomer };
    }

    if (queueItem.type === 'customer-update') {
      const { localId, serverId, normalized } = queueItem.payload;
      const targetId =
        serverId || (localId ? getServerCustomerId(localId) : null) || localId;

      if (!targetId || isLocalCustomerId(targetId)) {
        return { synced: false };
      }

      const res = await backupApi({
        method: 'put',
        url: `/customers/${targetId}`,
        data: normalized,
      });
      if (!res) return { synced: false };
      const customer = res.data?.customer || { ...normalized, _id: targetId, _pendingSync: false };
      upsertCustomerInCache(
        enrichCustomerRecord({ ...customer, _local: false, _pendingSync: false })
      );
      return { synced: true, customer };
    }

    return { synced: false };
  } catch (err) {
    if (shouldFallback(err)) return { synced: false };
    throw err;
  }
}

/**
 * Lưu khách — mobile: luôn ghi trên máy trước; Mac chỉ backup.
 */
export async function saveCustomer({ editingId, normalized }) {
  if (!isMobileDataEnabled()) {
    if (editingId) {
      const { data } = await api.put(`/customers/${editingId}`, normalized);
      return {
        customer: data.customer,
        synced: true,
        savedOnDevice: false,
        possibleDuplicates: [],
      };
    }
    const { data } = await api.post('/customers', normalized);
    return {
      customer: data.customer,
      synced: true,
      savedOnDevice: false,
      possibleDuplicates: data.possibleDuplicates || [],
    };
  }

  const customer = saveCustomerLocal(editingId, normalized);

  if (editingId) {
    queueCustomerSync('customer-update', {
      localId: isLocalCustomerId(editingId) ? editingId : null,
      serverId: isLocalCustomerId(editingId) ? getServerCustomerId(editingId) : editingId,
      normalized,
    });
  } else {
    queueCustomerSync('customer-create', { localId: customer._id, normalized });
  }

  import('./mobileRetailBridge')
    .then((m) => m.syncPendingQueue())
    .catch(() => {});

  return {
    customer,
    synced: false,
    savedOnDevice: true,
    possibleDuplicates: [],
    message: `${MSG_DEVICE_SAVED} — ${MSG_BACKUP_PENDING}`,
  };
}

/** Chuẩn hóa customerId trước khi gọi API bán hàng */
export function resolveCustomerIdForServer(customerId) {
  if (!customerId) return undefined;
  if (isLocalCustomerId(customerId)) {
    return getServerCustomerId(customerId) || undefined;
  }
  return customerId;
}

export function filterByTag(customers, tagId) {
  if (!tagId) return customers;
  return customers.filter((c) => (c.tags || []).some((t) => t.id === tagId));
}
