/**
 * Phiếu sửa máy khách — mobile offline-first, Mac backup qua sync queue.
 */
import api from '../api/client';
import {
  isMobileDataEnabled,
  loadCustomerRepairs,
  saveCustomerRepairs,
  newLocalId,
  pushSyncQueue,
  loadSyncQueue,
} from './mobileLocalDb';
import { sortRepairTickets } from '../constants/customerRepair';
import { mergeCustomerRepairsFromServer } from './mobileRepairLocal';
import {
  backupApi,
  hasBackupSession,
  MSG_DEVICE_SAVED,
  MSG_BACKUP_PENDING,
} from './mobileServerLink';
import { resolveCustomerIdForServer } from './mobileCustomerBridge';
import { isLocalCustomerId } from './mobileCustomerLocal';

export const REPAIR_DATA_CHANGED = 'nuocleo-repair-data-changed';
const ID_MAP_KEY = 'nuocleo_repair_id_map';
const TIMEOUT_MS = 1200;

const num = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function mapTicket(ticket) {
  const internalTotal = num(ticket.internal_parts_cost) + num(ticket.internal_labor_cost);
  return {
    ...ticket,
    internal_total_cost: internalTotal,
    profit_estimate: num(ticket.final_amount || ticket.quote_amount) - internalTotal,
    amount_due: Math.max(
      0,
      num(ticket.final_amount || ticket.quote_amount) - num(ticket.deposit_amount)
    ),
  };
}

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

export function isLocalRepairId(id) {
  return String(id || '').startsWith('loc_');
}

export function getServerRepairId(localOrServerId) {
  const id = String(localOrServerId || '');
  if (!id) return null;
  if (!isLocalRepairId(id)) return id;
  return readIdMap()[id] || null;
}

function setRepairIdMapping(localId, serverId) {
  const map = readIdMap();
  map[localId] = serverId;
  writeIdMap(map);
}

function replaceTicketId(localId, serverTicket) {
  const rows = loadCustomerRepairs().filter((t) => String(t._id) !== String(localId));
  const mapped = mapTicket({
    ...serverTicket,
    _id: serverTicket._id,
    _local: false,
    _pendingSync: false,
  });
  rows.unshift(mapped);
  saveCustomerRepairs(rows);
  return mapped;
}

function rewriteSyncQueueRepairIds(localId, serverId) {
  const queue = loadSyncQueue();
  let changed = false;
  const next = queue.map((item) => {
    if (!item?.payload) return item;
    const p = { ...item.payload };
    let hit = false;
    if (String(p.ticketId) === String(localId)) {
      p.ticketId = serverId;
      hit = true;
    }
    if (String(p.localId) === String(localId)) {
      p.localId = serverId;
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

export function notifyRepairDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REPAIR_DATA_CHANGED));
  }
}

function upsertTicket(ticket) {
  const rows = loadCustomerRepairs();
  const idx = rows.findIndex((t) => String(t._id) === String(ticket._id));
  const mapped = mapTicket(ticket);
  if (idx >= 0) rows[idx] = mapped;
  else rows.unshift(mapped);
  saveCustomerRepairs(rows);
  notifyRepairDataChanged();
  return mapped;
}

function findTicket(id) {
  return loadCustomerRepairs().find((t) => String(t._id) === String(id)) || null;
}

function pushStatusHistory(ticket, status, note) {
  const history = Array.isArray(ticket.status_history) ? [...ticket.status_history] : [];
  history.push({ status, note: note || '', at: new Date().toISOString() });
  return history;
}

function queueRepairSync(type, payload) {
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

function nextLocalTicketNumber() {
  const n = loadCustomerRepairs().filter((t) => String(t.ticket_number || '').includes('local')).length + 1;
  return `RP-local-${String(n).padStart(4, '0')}`;
}

export function listRepairsLocal({ status, q } = {}) {
  let tickets = loadCustomerRepairs().map(mapTicket);
  if (status) tickets = tickets.filter((t) => t.status === status);
  const query = String(q || '').trim().toLowerCase();
  if (query) {
    tickets = tickets.filter((t) => {
      const hay = [
        t.ticket_number,
        t.customer_name,
        t.customer_email,
        t.customer_phone,
        t.model_name,
        t.serial_number,
        t.symptom,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return hay.includes(query);
    });
  }
  return sortRepairTickets(tickets);
}

export function createRepairLocal(form = {}) {
  const now = new Date().toISOString();
  const id = newLocalId();
  const name = String(form.customer_name || '').trim();
  const email = String(form.customer_email || '').trim().toLowerCase();
  const model_name = String(form.model_name || '').trim();
  const symptom = String(form.symptom || '').trim();

  if (!name) throw new Error('Tên khách hàng là bắt buộc');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email khách hợp lệ là bắt buộc');
  }
  if (!model_name) throw new Error('Model máy là bắt buộc');
  if (!symptom) throw new Error('Triệu chứng / mô tả lỗi là bắt buộc');

  const ticket = mapTicket({
    _id: id,
    ticket_number: nextLocalTicketNumber(),
    customerId: form.customerId || null,
    customer_name: name,
    customer_email: email,
    customer_phone: String(form.customer_phone || '').trim(),
    model_name,
    brand: form.brand || '',
    serial_number: String(form.serial_number || '').trim().toUpperCase(),
    symptom,
    intake_note: form.intake_note || '',
    condition_at_intake: form.condition_at_intake || '',
    status: 'tiep_nhan',
    quote_amount: 0,
    deposit_amount: 0,
    final_amount: 0,
    internal_parts_cost: 0,
    internal_labor_cost: 0,
    work_logs: [],
    status_history: [{ status: 'tiep_nhan', note: 'Tiếp nhận máy khách', at: now }],
    received_at: now,
    createdAt: now,
    updatedAt: now,
    _local: true,
    _pendingSync: true,
  });

  upsertTicket(ticket);
  queueRepairSync('repair-create', { localId: id, form: { ...form }, skipEmail: true });
  return ticket;
}

export function quoteRepairLocal(ticketId, payload = {}) {
  const ticket = findTicket(ticketId);
  if (!ticket) throw new Error('Không tìm thấy phiếu');
  if (!['tiep_nhan', 'cho_khach_xac_nhan'].includes(ticket.status)) {
    throw new Error('Không thể gửi báo giá ở trạng thái hiện tại');
  }
  const quote_amount = num(payload.quote_amount);
  if (quote_amount <= 0) throw new Error('Báo giá phải lớn hơn 0');

  const now = new Date().toISOString();
  let confirm_token = '';
  try {
    confirm_token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    confirm_token = `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 14)}${Math.random().toString(16).slice(2, 14)}`;
  }
  const next = {
    ...ticket,
    quote_amount,
    quote_note: payload.quote_note || '',
    quote_lines: [{ label: 'Sửa chữa', amount: quote_amount }],
    deposit_amount: num(payload.deposit_amount),
    final_amount: quote_amount,
    status: 'cho_khach_xac_nhan',
    quote_sent_at: now,
    confirm_token,
    confirm_token_expires: new Date(Date.now() + 7 * 86400000).toISOString(),
    status_history: pushStatusHistory(
      ticket,
      'cho_khach_xac_nhan',
      `Gửi báo giá ${quote_amount.toLocaleString('vi-VN')}đ`
    ),
    updatedAt: now,
    _pendingSync: true,
  };
  const saved = upsertTicket(next);
  queueRepairSync('repair-quote', { ticketId, ...payload, skipEmail: true });
  return saved;
}

export function confirmRepairLocal(ticketId) {
  const ticket = findTicket(ticketId);
  if (!ticket) throw new Error('Không tìm thấy phiếu');
  if (ticket.status !== 'cho_khach_xac_nhan') {
    throw new Error('Phiếu không ở bước chờ khách xác nhận');
  }
  const now = new Date().toISOString();
  const next = {
    ...ticket,
    status: 'dang_sua',
    confirmed_at: now,
    confirmed_via: 'counter',
    repair_started_at: now,
    status_history: pushStatusHistory(ticket, 'dang_sua', 'Xác nhận tại quầy'),
    updatedAt: now,
    _pendingSync: true,
  };
  const saved = upsertTicket(next);
  queueRepairSync('repair-confirm', { ticketId });
  return saved;
}

export function addWorkLogLocal(ticketId, payload = {}) {
  const ticket = findTicket(ticketId);
  if (!ticket) throw new Error('Không tìm thấy phiếu');
  if (ticket.status !== 'dang_sua') throw new Error('Chỉ ghi nhật ký khi phiếu đang sửa');
  const description = String(payload.description || '').trim();
  if (!description) throw new Error('Mô tả công việc là bắt buộc');

  const parts = num(payload.parts_cost);
  const labor = num(payload.labor_cost);
  const total = parts + labor;
  const now = new Date().toISOString();
  const log = {
    _id: newLocalId(),
    description,
    vendor: payload.vendor || '',
    parts_cost: parts,
    labor_cost: labor,
    total_cost: total,
    at: now,
  };
  const next = {
    ...ticket,
    work_logs: [...(ticket.work_logs || []), log],
    internal_parts_cost: num(ticket.internal_parts_cost) + parts,
    internal_labor_cost: num(ticket.internal_labor_cost) + labor,
    updatedAt: now,
    _pendingSync: true,
  };
  const saved = upsertTicket(next);
  queueRepairSync('repair-work-log', { ticketId, ...payload });
  return saved;
}

export function readyRepairLocal(ticketId, payload = {}) {
  const ticket = findTicket(ticketId);
  if (!ticket) throw new Error('Không tìm thấy phiếu');
  if (ticket.status !== 'dang_sua') throw new Error('Phiếu phải ở trạng thái đang sửa');
  const now = new Date().toISOString();
  const next = {
    ...ticket,
    status: 'cho_tra',
    completed_at: now,
    final_amount: payload.final_amount != null ? num(payload.final_amount) : ticket.final_amount,
    status_history: pushStatusHistory(ticket, 'cho_tra', payload.note || 'Sửa xong — chờ trả máy'),
    updatedAt: now,
    _pendingSync: true,
  };
  const saved = upsertTicket(next);
  queueRepairSync('repair-ready', { ticketId, ...payload, skipEmail: true });
  return saved;
}

export function returnRepairLocal(ticketId, payload = {}) {
  const ticket = findTicket(ticketId);
  if (!ticket) throw new Error('Không tìm thấy phiếu');
  if (ticket.status !== 'cho_tra') throw new Error('Phiếu phải ở trạng thái chờ trả');
  const now = new Date().toISOString();
  const next = {
    ...ticket,
    status: 'da_tra',
    returned_at: now,
    final_amount:
      payload.collected_amount != null ? num(payload.collected_amount) : ticket.final_amount,
    status_history: pushStatusHistory(ticket, 'da_tra', payload.note || 'Đã trả máy cho khách'),
    updatedAt: now,
    _pendingSync: true,
  };
  const saved = upsertTicket(next);
  queueRepairSync('repair-return', { ticketId, ...payload });
  return saved;
}

export function cancelRepairLocal(ticketId, note) {
  const ticket = findTicket(ticketId);
  if (!ticket) throw new Error('Không tìm thấy phiếu');
  if (ticket.status === 'da_tra') throw new Error('Phiếu đã trả — không thể hủy');
  const now = new Date().toISOString();
  const next = {
    ...ticket,
    status: 'da_huy',
    status_history: pushStatusHistory(ticket, 'da_huy', note || 'Hủy phiếu'),
    updatedAt: now,
    _pendingSync: true,
  };
  const saved = upsertTicket(next);
  queueRepairSync('repair-cancel', { ticketId, note });
  return saved;
}

async function resolveTicketIdForServer(ticketId) {
  if (!ticketId) return null;
  if (!isLocalRepairId(ticketId)) return ticketId;
  return getServerRepairId(ticketId);
}

export async function trySyncRepairQueueItem(queueItem) {
  if (!hasBackupSession()) return { synced: false };

  try {
    if (queueItem.type === 'repair-create') {
      const { localId, form, skipEmail } = queueItem.payload || {};
      const body = { ...form, skipEmail: skipEmail !== false };
      if (body.customerId) {
        const resolved = resolveCustomerIdForServer(body.customerId);
        if (resolved) body.customerId = resolved;
        else if (isLocalCustomerId(body.customerId)) delete body.customerId;
      }
      const res = await backupApi({ method: 'post', url: '/repairs', data: body });
      if (!res?.data?.ticket) return { synced: false };
      const serverTicket = res.data.ticket;
      setRepairIdMapping(localId, serverTicket._id);
      replaceTicketId(localId, serverTicket);
      rewriteSyncQueueRepairIds(localId, serverTicket._id);
      notifyRepairDataChanged();
      return { synced: true, ticket: serverTicket };
    }

    const ticketId = await resolveTicketIdForServer(queueItem.payload?.ticketId);
    if (!ticketId || isLocalRepairId(ticketId)) return { synced: false };

    if (queueItem.type === 'repair-quote') {
      const { quote_amount, deposit_amount, quote_note, quote_lines, skipEmail } =
        queueItem.payload;
      const res = await backupApi({
        method: 'post',
        url: `/repairs/${ticketId}/quote`,
        data: {
          quote_amount,
          deposit_amount,
          quote_note,
          quote_lines,
          skipEmail: skipEmail !== false,
        },
      });
      if (!res?.data?.ticket) return { synced: false };
      upsertTicket({ ...res.data.ticket, _local: false, _pendingSync: false });
      return { synced: true };
    }

    if (queueItem.type === 'repair-confirm') {
      const res = await backupApi({
        method: 'post',
        url: `/repairs/${ticketId}/confirm-counter`,
      });
      if (!res?.data?.ticket) return { synced: false };
      upsertTicket({ ...res.data.ticket, _local: false, _pendingSync: false });
      return { synced: true };
    }

    if (queueItem.type === 'repair-work-log') {
      const { description, vendor, parts_cost, labor_cost } = queueItem.payload;
      const res = await backupApi({
        method: 'post',
        url: `/repairs/${ticketId}/work-logs`,
        data: { description, vendor, parts_cost, labor_cost },
      });
      if (!res?.data?.ticket) return { synced: false };
      upsertTicket({ ...res.data.ticket, _local: false, _pendingSync: false });
      return { synced: true };
    }

    if (queueItem.type === 'repair-ready') {
      const { skipEmail, ...readyPayload } = queueItem.payload || {};
      const res = await backupApi({
        method: 'post',
        url: `/repairs/${ticketId}/ready`,
        data: { ...readyPayload, skipEmail: skipEmail !== false },
      });
      if (!res?.data?.ticket) return { synced: false };
      upsertTicket({ ...res.data.ticket, _local: false, _pendingSync: false });
      return { synced: true };
    }

    if (queueItem.type === 'repair-return') {
      const res = await backupApi({
        method: 'post',
        url: `/repairs/${ticketId}/return`,
        data: queueItem.payload || {},
      });
      if (!res?.data?.ticket) return { synced: false };
      upsertTicket({ ...res.data.ticket, _local: false, _pendingSync: false });
      return { synced: true };
    }

    if (queueItem.type === 'repair-cancel') {
      const res = await backupApi({
        method: 'post',
        url: `/repairs/${ticketId}/cancel`,
        data: { note: queueItem.payload?.note },
      });
      if (!res?.data?.ticket) return { synced: false };
      upsertTicket({ ...res.data.ticket, _local: false, _pendingSync: false });
      return { synced: true };
    }

    return { synced: false };
  } catch (err) {
    if (shouldFallback(err)) return { synced: false };
    throw err;
  }
}

export async function loadRepairsBridge({ status, q } = {}) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.get('/repairs', { params: { status, q } });
    return { tickets: sortRepairTickets(data), source: 'server' };
  }

  const local = listRepairsLocal({ status, q });

  if (hasBackupSession()) {
    backupApi({
      method: 'get',
      url: '/repairs',
      params: { status, q },
      timeout: TIMEOUT_MS,
    })
      .then((res) => {
        if (Array.isArray(res?.data)) {
          mergeCustomerRepairsFromServer(res.data);
          notifyRepairDataChanged();
        }
      })
      .catch(() => {});
  }

  return { tickets: local, source: 'device' };
}

export async function createRepairBridge(form) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post('/repairs', form);
    return { ...data, savedOnDevice: false, synced: true };
  }
  const ticket = createRepairLocal(form);
  const { sendRepairIntakeFromDevice } = await import('./mobileDeviceEmail');
  let emailMeta = {
    emailSent: false,
    emailSentTo: null,
    emailSkipped: true,
    emailError: null,
  };
  try {
    const mail = await sendRepairIntakeFromDevice(ticket);
    if (mail.sent) {
      emailMeta = { emailSent: true, emailSentTo: mail.to, emailSkipped: false, emailError: null };
    } else if (mail.error) {
      emailMeta = {
        emailSent: false,
        emailSentTo: null,
        emailSkipped: false,
        emailError: mail.error,
      };
    }
  } catch (err) {
    emailMeta.emailError = err?.message || 'Gửi email thất bại';
    emailMeta.emailSkipped = false;
  }

  const message = emailMeta.emailSent
    ? `${MSG_DEVICE_SAVED} — đã gửi phiếu tiếp nhận tới ${emailMeta.emailSentTo}`
    : `${MSG_DEVICE_SAVED} — ${MSG_BACKUP_PENDING}`;

  return {
    message,
    ticket,
    savedOnDevice: true,
    synced: false,
    ...emailMeta,
  };
}

export async function quoteRepairBridge(ticketId, payload) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post(`/repairs/${ticketId}/quote`, payload);
    return data;
  }
  const ticket = quoteRepairLocal(ticketId, payload);
  const { sendRepairQuoteFromDevice } = await import('./mobileDeviceEmail');
  let emailMeta = { emailSent: false, emailSentTo: null, emailSkipped: true, emailError: null };
  try {
    const mail = await sendRepairQuoteFromDevice(ticket);
    if (mail.sent) {
      emailMeta = { emailSent: true, emailSentTo: mail.to, emailSkipped: false, emailError: null };
    } else if (mail.error) {
      emailMeta = {
        emailSent: false,
        emailSentTo: null,
        emailSkipped: false,
        emailError: mail.error,
      };
    }
  } catch (err) {
    emailMeta = {
      emailSent: false,
      emailSentTo: null,
      emailSkipped: false,
      emailError: err?.message || 'Gửi email thất bại',
    };
  }
  return {
    message: emailMeta.emailSent
      ? `${MSG_DEVICE_SAVED} — đã gửi báo giá tới ${emailMeta.emailSentTo}`
      : `${MSG_DEVICE_SAVED} — ${MSG_BACKUP_PENDING}`,
    ticket,
    ...emailMeta,
  };
}

export async function confirmRepairBridge(ticketId) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post(`/repairs/${ticketId}/confirm-counter`);
    return data;
  }
  const ticket = confirmRepairLocal(ticketId);
  return { message: 'Khách đã xác nhận tại quầy — bắt đầu sửa', ticket };
}

export async function workLogRepairBridge(ticketId, payload) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post(`/repairs/${ticketId}/work-logs`, payload);
    return data;
  }
  const ticket = addWorkLogLocal(ticketId, payload);
  return { message: 'Đã ghi nhật ký sửa', ticket };
}

export async function readyRepairBridge(ticketId, payload = {}) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post(`/repairs/${ticketId}/ready`, payload);
    return data;
  }
  const ticket = readyRepairLocal(ticketId, payload);
  const { sendRepairReadyFromDevice } = await import('./mobileDeviceEmail');
  let emailMeta = { emailSent: false, emailSentTo: null, emailSkipped: true, emailError: null };
  try {
    const mail = await sendRepairReadyFromDevice(ticket);
    if (mail.sent) {
      emailMeta = { emailSent: true, emailSentTo: mail.to, emailSkipped: false, emailError: null };
    } else if (mail.error) {
      emailMeta = {
        emailSent: false,
        emailSentTo: null,
        emailSkipped: false,
        emailError: mail.error,
      };
    }
  } catch (err) {
    emailMeta = {
      emailSent: false,
      emailSentTo: null,
      emailSkipped: false,
      emailError: err?.message || 'Gửi email thất bại',
    };
  }
  return {
    message: emailMeta.emailSent
      ? `${MSG_DEVICE_SAVED} — đã gửi thông báo sẵn sàng tới ${emailMeta.emailSentTo}`
      : `${MSG_DEVICE_SAVED} — ${MSG_BACKUP_PENDING}`,
    ticket,
    ...emailMeta,
  };
}

export async function returnRepairBridge(ticketId, payload = {}) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post(`/repairs/${ticketId}/return`, payload);
    return data;
  }
  const ticket = returnRepairLocal(ticketId, payload);
  return { message: 'Đã trả máy cho khách', ticket };
}

export async function cancelRepairBridge(ticketId, note) {
  if (!isMobileDataEnabled()) {
    const { data } = await api.post(`/repairs/${ticketId}/cancel`, { note });
    return data;
  }
  const ticket = cancelRepairLocal(ticketId, note);
  return { message: 'Đã hủy phiếu', ticket };
}
