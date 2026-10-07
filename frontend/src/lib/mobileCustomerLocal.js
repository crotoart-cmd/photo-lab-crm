/**
 * Khách hàng lưu trên máy + map ID local ↔ server.
 */
import {
  newLocalId,
  pushSyncQueue,
  loadSyncQueue,
} from './mobileLocalDb';
import { buildSearchKey, fullName } from '../utils/customerNormalize';

const CACHE_KEY = 'nuocleo_customers_enriched';
const ID_MAP_KEY = 'nuocleo_customer_id_map';

function readCacheRaw() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCacheRaw(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, at: Date.now() }));
}

export function getCachedCustomersList() {
  return readCacheRaw()?.data || [];
}

export function readCustomerIdMap() {
  try {
    return JSON.parse(localStorage.getItem(ID_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

export function writeCustomerIdMap(map) {
  localStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
}

export function isLocalCustomerId(id) {
  return String(id || '').startsWith('loc_');
}

export function getServerCustomerId(localOrServerId) {
  const id = String(localOrServerId || '');
  if (!id) return null;
  if (!isLocalCustomerId(id)) return id;
  return readCustomerIdMap()[id] || null;
}

export function setCustomerIdMapping(localId, serverId) {
  const map = readCustomerIdMap();
  map[localId] = serverId;
  writeCustomerIdMap(map);
}

export function enrichCustomerRecord(customer) {
  return {
    stats: {},
    tags: [],
    ltvGrade: 'C',
    ...customer,
    searchKey: buildSearchKey(customer),
  };
}

function nextLocalCustomerCode(customers) {
  const n =
    customers.filter((c) => String(c.customerCode || '').startsWith('LOC-')).length + 1;
  return `LOC-${String(n).padStart(4, '0')}`;
}

export function upsertCustomerInCache(customer) {
  const list = getCachedCustomersList();
  const idx = list.findIndex((c) => String(c._id) === String(customer._id));
  const enriched = enrichCustomerRecord(customer);
  if (idx >= 0) list[idx] = enriched;
  else list.unshift(enriched);
  writeCacheRaw(list);
  return enriched;
}

export function replaceCustomerIdInCache(localId, serverCustomer) {
  const list = getCachedCustomersList().filter((c) => String(c._id) !== String(localId));
  const enriched = enrichCustomerRecord({
    ...serverCustomer,
    _local: false,
    _pendingSync: false,
  });
  list.unshift(enriched);
  writeCacheRaw(list);
  return enriched;
}

export function mergeServerCustomersWithLocalPending(serverRows) {
  const cached = getCachedCustomersList();
  const map = readCustomerIdMap();
  const serverIds = new Set(serverRows.map((c) => String(c._id)));

  const pendingLocal = cached.filter((c) => {
    if (!c._local || !c._pendingSync) return false;
    const mapped = map[c._id];
    if (mapped && serverIds.has(String(mapped))) return false;
    return !serverIds.has(String(c._id));
  });

  return [...serverRows.map(enrichCustomerRecord), ...pendingLocal];
}

export function saveCustomerLocal(editingId, normalized) {
  const list = getCachedCustomersList();
  const now = new Date().toISOString();

  if (editingId) {
    const idx = list.findIndex((c) => String(c._id) === String(editingId));
    const prev = idx >= 0 ? list[idx] : null;
    const updated = enrichCustomerRecord({
      ...(prev || {}),
      ...normalized,
      _id: editingId,
      _local: true,
      _pendingSync: true,
      updatedAt: now,
      customerCode: prev?.customerCode || nextLocalCustomerCode(list),
    });
    upsertCustomerInCache(updated);
    return updated;
  }

  const created = enrichCustomerRecord({
    ...normalized,
    _id: newLocalId(),
    _local: true,
    _pendingSync: true,
    createdAt: now,
    updatedAt: now,
    customerCode: nextLocalCustomerCode(list),
  });
  upsertCustomerInCache(created);
  return created;
}

export function rewriteSyncQueueCustomerIds(localId, serverId) {
  const q = loadSyncQueue();
  let changed = false;
  const next = q.map((item) => {
    const payload = item.payload;
    if (!payload) return item;

    if (
      (item.type === 'checkout-cart' || item.type === 'sale' || item.type === 'intake') &&
      payload.customerId === localId
    ) {
      changed = true;
      return { ...item, payload: { ...payload, customerId: serverId } };
    }

    if (item.type === 'customer-update' && payload.localId === localId) {
      changed = true;
      return {
        ...item,
        payload: { ...payload, serverId, localId },
      };
    }

    return item;
  });

  if (changed) {
    localStorage.setItem('nuocleo_local_sync_queue', JSON.stringify(next));
  }
}

export function queueCustomerSync(type, payload) {
  pushSyncQueue({ id: newLocalId(), type, payload });
}

export function findCustomerInCache(id) {
  return getCachedCustomersList().find((c) => String(c._id) === String(id)) || null;
}

export function customerDisplayName(customer) {
  return fullName(customer) || customer?.email || 'Khách';
}
