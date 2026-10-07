/**
 * Bridge phiếu film — máy trước, Mac backup.
 */
import api from '../api/client';
import {
  isMobileDataEnabled,
  newLocalId,
  pushSyncQueue,
  loadSyncQueue,
  loadLabFilms,
  saveLabFilms,
} from './mobileLocalDb';
import {
  receiveFilmLocal,
  listFilmsLocal,
  getFilmLocal,
  updateFilmStatusLocal,
  batchStatusLocal,
  mergeLabFilmsFromServer,
  upsertLabFilm,
  findLabFilm,
} from './mobileFilmLabLocal';
import {
  backupApi,
  hasBackupSession,
  MSG_DEVICE_SAVED,
  MSG_BACKUP_PENDING,
} from './mobileServerLink';
import { resolveCustomerIdForServer } from './mobileCustomerBridge';
import { isLocalCustomerId } from './mobileCustomerLocal';

export const FILM_LAB_DATA_CHANGED = 'nuocleo-film-lab-data-changed';
const ID_MAP_KEY = 'nuocleo_film_lab_id_map';
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

export function isLocalFilmId(id) {
  return String(id || '').startsWith('loc_');
}

export function getServerFilmId(localOrServerId) {
  const id = String(localOrServerId || '');
  if (!id) return null;
  if (!isLocalFilmId(id)) return id;
  return readIdMap()[id] || null;
}

function setFilmIdMapping(localId, serverId) {
  const map = readIdMap();
  map[localId] = serverId;
  writeIdMap(map);
}

function replaceFilmId(localId, serverFilm) {
  const rows = loadLabFilms().filter((f) => String(f._id) !== String(localId));
  rows.unshift({ ...serverFilm, _id: serverFilm._id, _local: false, _pendingSync: false });
  saveLabFilms(rows);
}

function rewriteSyncQueueFilmIds(localId, serverId) {
  const queue = loadSyncQueue();
  let changed = false;
  const next = queue.map((item) => {
    if (!item?.payload) return item;
    const p = { ...item.payload };
    let hit = false;
    if (String(p.filmId) === String(localId)) {
      p.filmId = serverId;
      hit = true;
    }
    if (String(p.localId) === String(localId)) {
      p.localId = serverId;
      hit = true;
    }
    if (Array.isArray(p.ids)) {
      const mapped = p.ids.map((id) => (String(id) === String(localId) ? serverId : id));
      if (mapped.some((id, i) => String(id) !== String(p.ids[i]))) {
        p.ids = mapped;
        hit = true;
      }
    }
    if (!hit) return item;
    changed = true;
    return { ...item, payload: p };
  });
  if (changed) {
    localStorage.setItem('nuocleo_local_sync_queue', JSON.stringify(next));
  }
}

export function notifyFilmLabDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FILM_LAB_DATA_CHANGED));
  }
}

function queueFilmSync(type, payload) {
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

export async function loadFilmsBridge(params = {}) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.get('/films', { params });
    return { films: data, source: 'server' };
  }

  const local = listFilmsLocal(params);
  if (hasBackupSession()) {
    backupApi({ method: 'get', url: '/films', params, timeout: TIMEOUT_MS })
      .then((res) => {
        if (Array.isArray(res?.data)) {
          mergeLabFilmsFromServer(res.data);
          notifyFilmLabDataChanged();
        }
      })
      .catch(() => {});
  }
  return { films: local, source: 'device' };
}

export async function searchFilmsBridge(q) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.get('/films/search', { params: { q } });
    return data;
  }
  return listFilmsLocal({ q });
}

export async function getFilmBridge(id) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.get(`/films/${id}`);
    return data;
  }
  const local = getFilmLocal(id);
  if (local) return local;
  if (!hasBackupSession() || isLocalFilmId(id)) {
    throw new Error('Không tìm thấy phiếu trên máy');
  }
  const res = await backupApi({ method: 'get', url: `/films/${id}`, timeout: TIMEOUT_MS });
  if (!res?.data) throw new Error('Không tìm thấy phiếu');
  upsertLabFilm({ ...res.data, _local: false });
  return res.data;
}

export async function receiveFilmBridge(payload) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post('/films/receive', payload);
    return { ...data, savedOnDevice: false, synced: true };
  }

  const film = receiveFilmLocal(payload);
  queueFilmSync('film-receive', { localId: film._id, payload, skipEmail: true });
  notifyFilmLabDataChanged();

  let emailSent = false;
  let emailSentTo = null;
  let emailError = null;
  let emailSkipped = false;
  try {
    const { sendFilmReceiptFromDevice } = await import('./mobileDeviceEmail');
    const mail = await sendFilmReceiptFromDevice(film);
    if (mail.sent) {
      emailSent = true;
      emailSentTo = mail.to;
    } else if (mail.skipped) {
      emailSkipped = true;
    } else if (mail.error) {
      emailError = mail.error;
    } else {
      emailSkipped = true;
    }
  } catch (err) {
    emailError = err?.message || 'Gửi email thất bại';
  }

  const message = emailSent
    ? `${MSG_DEVICE_SAVED} — đã gửi phiếu tiếp nhận tới ${emailSentTo}`
    : `${MSG_DEVICE_SAVED} — ${MSG_BACKUP_PENDING}`;

  return {
    message,
    film,
    slip: film,
    savedOnDevice: true,
    synced: false,
    emailSent,
    emailSentTo,
    emailSkipped,
    emailError,
  };
}

async function applyDeviceMail(sendFn) {
  try {
    const mail = await sendFn();
    if (mail.sent) {
      return { emailSent: true, emailSentTo: mail.to, emailSkipped: false, emailError: null };
    }
    if (mail.skipped) {
      return {
        emailSent: false,
        emailSentTo: null,
        emailSkipped: true,
        emailError: null,
        emailSkippedReason: mail.reason,
      };
    }
    return {
      emailSent: false,
      emailSentTo: null,
      emailSkipped: false,
      emailError: mail.error || 'Gửi email thất bại',
    };
  } catch (err) {
    return {
      emailSent: false,
      emailSentTo: null,
      emailSkipped: false,
      emailError: err?.message || 'Gửi email thất bại',
    };
  }
}

export async function updateFilmStatusBridge(id, status, extra = {}) {
  if (!isMobileDataEnabled()) {
    if (status === 'processing') {
      const { data } = await api.put(`/films/${id}/start-processing`, { note: extra.note || 'Bắt đầu tráng' });
      return data;
    }
    if (status === 'completed') {
      const { data } = await api.put(`/films/${id}/complete`, {
        processingNotes: extra.processingNotes || 'Hoàn thành tráng',
      });
      return data;
    }
    if (status === 'delivered') {
      const { data } = await api.put(`/films/${id}/deliver`, {});
      return data;
    }
    throw new Error('Trạng thái không hỗ trợ');
  }

  const film = updateFilmStatusLocal(id, status, extra);
  queueFilmSync('film-status', { filmId: id, status, extra, skipEmail: true });
  notifyFilmLabDataChanged();

  let emailMeta = {
    emailSent: false,
    emailSentTo: null,
    emailSkipped: true,
    emailError: null,
  };
  if (status === 'completed') {
    const { sendFilmCompletionFromDevice } = await import('./mobileDeviceEmail');
    emailMeta = await applyDeviceMail(() => sendFilmCompletionFromDevice(film));
  } else if (status === 'delivered') {
    const { sendFilmDeliveryFromDevice } = await import('./mobileDeviceEmail');
    emailMeta = await applyDeviceMail(() => sendFilmDeliveryFromDevice(film));
  }

  const message = emailMeta.emailSent
    ? `${MSG_DEVICE_SAVED} — đã gửi email tới ${emailMeta.emailSentTo}`
    : `${MSG_DEVICE_SAVED} — ${MSG_BACKUP_PENDING}`;

  return {
    message,
    film,
    ...emailMeta,
  };
}

export async function batchFilmStatusBridge(ids, status, extra = {}) {
  if (!isMobileDataEnabled()) {
    if (status === 'processing') {
      const { data } = await api.post('/films/batch/start-processing', { ids });
      return data;
    }
    if (status === 'completed') {
      const { data } = await api.post('/films/batch/complete', {
        ids,
        processingNotes: extra.processingNotes || 'Hoàn thành tráng',
      });
      return data;
    }
    if (status === 'delivered') {
      const { data } = await api.post('/films/batch/deliver', { ids });
      return data;
    }
    throw new Error('Batch không hỗ trợ');
  }

  const result = batchStatusLocal(ids, status, extra);
  queueFilmSync('film-batch', { ids, status, extra, skipEmail: true });
  notifyFilmLabDataChanged();

  let emailSentCount = 0;
  let emailErrorCount = 0;
  if (status === 'completed' || status === 'delivered') {
    const {
      sendFilmCompletionFromDevice,
      sendFilmDeliveryFromDevice,
    } = await import('./mobileDeviceEmail');
    const { getFilmLocal } = await import('./mobileFilmLabLocal');
    for (const id of ids) {
      const film = getFilmLocal(id);
      if (!film) continue;
      const mail =
        status === 'completed'
          ? await applyDeviceMail(() => sendFilmCompletionFromDevice(film))
          : await applyDeviceMail(() => sendFilmDeliveryFromDevice(film));
      if (mail.emailSent) emailSentCount += 1;
      else if (mail.emailError) emailErrorCount += 1;
    }
  }

  return {
    ...result,
    emailSentCount,
    emailErrorCount,
    message:
      emailSentCount > 0
        ? `${result.message || MSG_DEVICE_SAVED} — đã gửi ${emailSentCount} email`
        : result.message || `${MSG_DEVICE_SAVED} — ${MSG_BACKUP_PENDING}`,
  };
}

export async function trySyncFilmQueueItem(queueItem) {
  if (!hasBackupSession()) return { synced: false };

  try {
    if (queueItem.type === 'film-receive') {
      const { localId, payload, skipEmail } = queueItem.payload || {};
      const body = { ...payload, skipEmail: skipEmail !== false };
      if (body.customerId) {
        const resolved = resolveCustomerIdForServer(body.customerId);
        if (resolved) body.customerId = resolved;
        else if (isLocalCustomerId(body.customerId)) return { synced: false };
      }
      const res = await backupApi({ method: 'post', url: '/films/receive', data: body });
      if (!res?.data?.film && !res?.data?.slip) return { synced: false };
      const serverFilm = res.data.film || res.data.slip;
      setFilmIdMapping(localId, serverFilm._id);
      replaceFilmId(localId, serverFilm);
      rewriteSyncQueueFilmIds(localId, serverFilm._id);
      notifyFilmLabDataChanged();
      return { synced: true };
    }

    if (queueItem.type === 'film-status') {
      const { filmId, status, extra, skipEmail } = queueItem.payload || {};
      const serverId = getServerFilmId(filmId) || filmId;
      if (!serverId || isLocalFilmId(serverId)) return { synced: false };

      let res = null;
      const emailFlag = { skipEmail: skipEmail !== false };
      if (status === 'processing') {
        res = await backupApi({
          method: 'put',
          url: `/films/${serverId}/start-processing`,
          data: { note: extra?.note || 'Bắt đầu tráng', ...emailFlag },
        });
      } else if (status === 'completed') {
        res = await backupApi({
          method: 'put',
          url: `/films/${serverId}/complete`,
          data: {
            processingNotes: extra?.processingNotes || 'Hoàn thành tráng',
            ...emailFlag,
          },
        });
      } else if (status === 'delivered') {
        res = await backupApi({
          method: 'put',
          url: `/films/${serverId}/deliver`,
          data: emailFlag,
        });
      }
      if (!res) return { synced: false };
      if (res.data?.film) {
        upsertLabFilm({ ...res.data.film, _local: false, _pendingSync: false });
      } else {
        const local = findLabFilm(filmId) || findLabFilm(serverId);
        if (local) upsertLabFilm({ ...local, _pendingSync: false, _local: false });
      }
      return { synced: true };
    }

    if (queueItem.type === 'film-batch') {
      const { ids, status, extra, skipEmail } = queueItem.payload || {};
      const serverIds = (ids || [])
        .map((id) => getServerFilmId(id) || id)
        .filter((id) => id && !isLocalFilmId(id));
      if (serverIds.length === 0) return { synced: false };

      let res = null;
      const emailFlag = { skipEmail: skipEmail !== false };
      if (status === 'processing') {
        res = await backupApi({
          method: 'post',
          url: '/films/batch/start-processing',
          data: { ids: serverIds, ...emailFlag },
        });
      } else if (status === 'completed') {
        res = await backupApi({
          method: 'post',
          url: '/films/batch/complete',
          data: {
            ids: serverIds,
            processingNotes: extra?.processingNotes || 'Hoàn thành tráng',
            ...emailFlag,
          },
        });
      } else if (status === 'delivered') {
        res = await backupApi({
          method: 'post',
          url: '/films/batch/deliver',
          data: { ids: serverIds, ...emailFlag },
        });
      }
      if (!res) return { synced: false };
      return { synced: true };
    }

    return { synced: false };
  } catch (err) {
    if (shouldFallback(err)) return { synced: false };
    throw err;
  }
}
