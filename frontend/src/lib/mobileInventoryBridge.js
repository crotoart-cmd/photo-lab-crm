/**
 * Bridge tồn kho — máy trước, Mac backup.
 */
import api from '../api/client';
import {
  isMobileDataEnabled,
  newLocalId,
  pushSyncQueue,
  loadSyncQueue,
  loadInventory,
  saveInventory,
} from './mobileLocalDb';
import {
  listInventoryLocal,
  listInventoryLogsLocal,
  getInventoryAlertsLocal,
  upsertInventoryLocal,
  adjustInventoryLocal,
  applyNaturalLossLocal,
  mergeInventoryFromServer,
  mergeInventoryLogsFromServer,
} from './mobileInventoryLocal';
import {
  backupApi,
  hasBackupSession,
  MSG_DEVICE_SAVED,
  MSG_BACKUP_PENDING,
} from './mobileServerLink';

export const INVENTORY_DATA_CHANGED = 'nuocleo-inventory-data-changed';
const ID_MAP_KEY = 'nuocleo_inventory_id_map';
const TIMEOUT_MS = 1200;

function readIdMap() {
  try {
    return JSON.parse(localStorage.getItem(ID_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeIdMap(map) {
  localStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
}

export function isLocalInventoryId(id) {
  return String(id || '').startsWith('loc_');
}

export function getServerInventoryId(localOrServerId) {
  const id = String(localOrServerId || '');
  if (!id) return null;
  if (!isLocalInventoryId(id)) return id;
  return readIdMap()[id] || null;
}

function setInventoryIdMapping(localId, serverId) {
  const map = readIdMap();
  map[localId] = serverId;
  writeIdMap(map);
}

function replaceInventoryId(localId, serverItem) {
  const rows = loadInventory().filter((i) => String(i._id) !== String(localId));
  rows.unshift({ ...serverItem, _id: serverItem._id, _local: false, _pendingSync: false });
  saveInventory(rows);
}

function rewriteSyncQueueInventoryIds(localId, serverId) {
  const queue = loadSyncQueue();
  let changed = false;
  const next = queue.map((item) => {
    if (!item?.payload) return item;
    const p = { ...item.payload };
    let hit = false;
    if (String(p.itemId) === String(localId)) {
      p.itemId = serverId;
      hit = true;
    }
    if (String(p.localId) === String(localId)) {
      p.localId = serverId;
      hit = true;
    }
    if (String(p.editingId) === String(localId)) {
      p.editingId = serverId;
      p.isCreate = false;
      hit = true;
    }
    if (!hit) return item;
    changed = true;
    return { ...item, payload: p };
  });
  if (changed) {
    localStorage.setItem('nuocleo_local_sync_queue', JSON.stringify(next));
  }
}

export function notifyInventoryDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(INVENTORY_DATA_CHANGED));
  }
}

function queueInventorySync(type, payload) {
  const item = { id: newLocalId(), type, payload };
  pushSyncQueue(item);
  import('./mobileRetailBridge')
    .then((m) => m.syncPendingQueue())
    .catch(() => {});
  return item;
}

function shouldFallback(err) {
  if (!err?.response) return true;
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') return true;
  const status = err.response?.status;
  if (status === 401) return true;
  return status >= 502 && status <= 504;
}

export async function loadInventoryBridge(params = {}) {
  if (!isMobileDataEnabled()) {
    const [itemsRes, logsRes, alertsRes] = await Promise.all([
      api.get('/inventory', { params }),
      api.get('/inventory/meta/logs', { params: { limit: 60 } }),
      api.get('/inventory/meta/alerts'),
    ]);
    return {
      items: itemsRes.data,
      logs: logsRes.data,
      alerts: alertsRes.data,
      source: 'server',
    };
  }

  const snapshot = {
    items: listInventoryLocal(params),
    logs: listInventoryLogsLocal({ limit: 60 }),
    alerts: getInventoryAlertsLocal(),
    source: 'device',
  };

  if (hasBackupSession()) {
    Promise.all([
      backupApi({ method: 'get', url: '/inventory', params, timeout: TIMEOUT_MS }),
      backupApi({
        method: 'get',
        url: '/inventory/meta/logs',
        params: { limit: 60 },
        timeout: TIMEOUT_MS,
      }),
    ])
      .then(([itemsRes, logsRes]) => {
        if (Array.isArray(itemsRes?.data)) mergeInventoryFromServer(itemsRes.data);
        if (Array.isArray(logsRes?.data)) mergeInventoryLogsFromServer(logsRes.data);
        notifyInventoryDataChanged();
      })
      .catch(() => {});
  }

  return snapshot;
}

export async function upsertInventoryBridge(payload, editingId = null) {
  if (!isMobileDataEnabled()) {
    if (editingId) {
      const { data } = await api.put(`/inventory/${editingId}`, payload);
      return { ...data, savedOnDevice: false, synced: true };
    }
    const { data } = await api.post('/inventory', payload);
    return { ...data, savedOnDevice: false, synced: true };
  }

  const item = upsertInventoryLocal(payload, editingId);
  queueInventorySync('inventory-upsert', {
    localId: item._id,
    editingId,
    payload,
    isCreate: !editingId,
  });
  notifyInventoryDataChanged();
  return {
    message: `${MSG_DEVICE_SAVED} — ${MSG_BACKUP_PENDING}`,
    item,
    savedOnDevice: true,
    synced: false,
  };
}

export async function adjustInventoryBridge(id, body) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.patch(`/inventory/${id}/quantity`, body);
    return { ...data, savedOnDevice: false, synced: true };
  }

  const item = adjustInventoryLocal(id, body);
  queueInventorySync('inventory-adjust', { itemId: id, body });
  notifyInventoryDataChanged();
  return {
    message: `${MSG_DEVICE_SAVED} — ${MSG_BACKUP_PENDING}`,
    item,
    savedOnDevice: true,
    synced: false,
  };
}

export async function applyNaturalLossBridge(body) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post('/inventory/apply-natural-loss', body);
    return data;
  }
  const result = applyNaturalLossLocal(body);
  // Mỗi mặt hàng chemical đã chỉnh — queue adjust tương ứng khi sync lần sau qua upsert snapshot
  for (const u of result.updates || []) {
    queueInventorySync('inventory-adjust', {
      itemId: u.id,
      body: {
        quantity: u.quantityAfterMl,
        restock: false,
        actionType: 'natural_loss',
        reason: body.reason || `Hao hụt tự nhiên ${body.percent}%`,
      },
    });
  }
  notifyInventoryDataChanged();
  return result;
}

export async function trySyncInventoryQueueItem(queueItem) {
  if (!hasBackupSession()) return { synced: false };

  try {
    if (queueItem.type === 'inventory-upsert') {
      const { localId, editingId, payload, isCreate } = queueItem.payload || {};
      const mappedEditing = editingId ? getServerInventoryId(editingId) || editingId : null;

      if (isCreate || !mappedEditing || isLocalInventoryId(mappedEditing)) {
        // Chưa có bản trên Mac — tạo mới (kể cả khi đang sửa bản local chưa sync)
        const res = await backupApi({ method: 'post', url: '/inventory', data: payload });
        if (!res?.data?.item) return { synced: false };
        const serverItem = res.data.item;
        const fromId = localId || editingId;
        setInventoryIdMapping(fromId, serverItem._id);
        replaceInventoryId(fromId, serverItem);
        rewriteSyncQueueInventoryIds(fromId, serverItem._id);
        notifyInventoryDataChanged();
        return { synced: true };
      }

      const serverId = mappedEditing;
      const res = await backupApi({
        method: 'put',
        url: `/inventory/${serverId}`,
        data: payload,
      });
      if (!res?.data?.item) return { synced: false };
      const rows = loadInventory();
      const idx = rows.findIndex(
        (i) => String(i._id) === String(serverId) || String(i._id) === String(editingId)
      );
      if (idx >= 0) {
        rows[idx] = { ...res.data.item, _local: false, _pendingSync: false };
        saveInventory(rows);
      }
      return { synced: true };
    }

    if (queueItem.type === 'inventory-adjust') {
      const { itemId, body } = queueItem.payload || {};
      const serverId = getServerInventoryId(itemId) || itemId;
      if (!serverId || isLocalInventoryId(serverId)) return { synced: false };
      const res = await backupApi({
        method: 'patch',
        url: `/inventory/${serverId}/quantity`,
        data: body,
      });
      if (!res) return { synced: false };
      if (res.data?.item) {
        const rows = loadInventory();
        const idx = rows.findIndex(
          (i) => String(i._id) === String(serverId) || String(i._id) === String(itemId)
        );
        if (idx >= 0) {
          rows[idx] = { ...res.data.item, _local: false, _pendingSync: false };
          saveInventory(rows);
        }
      }
      return { synced: true };
    }

    return { synced: false };
  } catch (err) {
    if (shouldFallback(err)) return { synced: false };
    throw err;
  }
}
