/**
 * Phiếu film lab — lưu cục bộ trên máy.
 */
import { loadLabFilms, saveLabFilms, newLocalId } from './mobileLocalDb';
import { findCustomerInCache } from './mobileCustomerLocal';

const FILM_STATUSES = ['received', 'processing', 'completed', 'delivered', 'cancelled'];

function toTime(value) {
  const t = new Date(value || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function enrichFilmCustomer(film) {
  if (film.customerId && typeof film.customerId === 'object') return film;
  const customer = findCustomerInCache(film.customerId);
  if (!customer) return film;
  return { ...film, customerId: customer };
}

function nextConfirmationCode() {
  const n = loadLabFilms().length + 1;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PH-${String(n).padStart(4, '0')}${rand.slice(0, 2)}`;
}

function nextTicketNumber() {
  const d = new Date();
  const key = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const todayCount =
    loadLabFilms().filter((f) => String(f.ticketNumber || '').includes(key)).length + 1;
  return `PH-${key}-${String(todayCount).padStart(4, '0')}`;
}

function pushStatusHistory(film, status, note) {
  const history = Array.isArray(film.statusHistory) ? [...film.statusHistory] : [];
  history.push({ status, note: note || '', at: new Date().toISOString() });
  return history;
}

export function upsertLabFilm(film) {
  const rows = loadLabFilms();
  const idx = rows.findIndex((f) => String(f._id) === String(film._id));
  if (idx >= 0) rows[idx] = film;
  else rows.unshift(film);
  saveLabFilms(rows);
  return film;
}

export function findLabFilm(id) {
  return loadLabFilms().find((f) => String(f._id) === String(id)) || null;
}

export function receiveFilmLocal(payload = {}) {
  const customerId = payload.customerId;
  if (!customerId) throw new Error('Vui lòng chọn khách hàng');

  const now = new Date().toISOString();
  const id = newLocalId();
  const confirmationCode = nextConfirmationCode();
  const ticketNumber = nextTicketNumber();
  const film = {
    _id: id,
    customerId,
    ticketNumber,
    filmCode: `FM-local-${id.slice(-6).toUpperCase()}`,
    confirmationCode,
    quantity: Number(payload.quantity) || 1,
    filmType: payload.filmType || 'color',
    receptionNotes: payload.receptionNotes || '',
    intakeChecklist: payload.intakeChecklist || {},
    status: 'received',
    statusHistory: [{ status: 'received', note: 'Tiếp nhận trên máy', at: now }],
    createdAt: now,
    updatedAt: now,
    _local: true,
    _pendingSync: true,
  };

  upsertLabFilm(film);
  return enrichFilmCustomer(film);
}

export function listFilmsLocal(params = {}) {
  let rows = loadLabFilms().map(enrichFilmCustomer);
  if (params.status) {
    rows = rows.filter((f) => f.status === params.status);
  }
  const q = String(params.q || '').trim().toLowerCase();
  if (q) {
    const upper = q.toUpperCase();
    rows = rows.filter((f) => {
      const c = f.customerId && typeof f.customerId === 'object' ? f.customerId : null;
      const name = c ? `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase() : '';
      const email = String(c?.email || '').toLowerCase();
      const phone = String(c?.phone || '');
      return (
        String(f.confirmationCode || '').toUpperCase().includes(upper) ||
        String(f.ticketNumber || '').toUpperCase().includes(upper) ||
        String(f.filmCode || '').toUpperCase().includes(upper) ||
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q)
      );
    });
  }
  return rows.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
}

export function getFilmLocal(id) {
  const film = findLabFilm(id);
  return film ? enrichFilmCustomer(film) : null;
}

export function updateFilmStatusLocal(id, status, extra = {}) {
  if (!FILM_STATUSES.includes(status)) throw new Error('Trạng thái không hợp lệ');
  const film = findLabFilm(id);
  if (!film) throw new Error('Không tìm thấy phiếu');

  const transitions = {
    processing: 'received',
    completed: 'processing',
    delivered: 'completed',
  };
  const required = transitions[status];
  if (required && film.status !== required) {
    throw new Error(`Phiếu không thể chuyển sang ${status} từ ${film.status}`);
  }

  const now = new Date().toISOString();
  const next = {
    ...film,
    status,
    statusHistory: pushStatusHistory(film, status, extra.note || extra.processingNotes || ''),
    updatedAt: now,
    _pendingSync: true,
  };

  if (status === 'processing') next.processingStartedAt = now;
  if (status === 'completed') {
    next.processingCompletedAt = now;
    next.processingNotes = extra.processingNotes || film.processingNotes || '';
  }
  if (status === 'delivered') next.deliveredAt = now;

  upsertLabFilm(next);
  return enrichFilmCustomer(next);
}

export function batchStatusLocal(ids, status, extra = {}) {
  const results = { success: [], failed: [], failedCount: 0, message: '' };
  for (const id of ids || []) {
    try {
      const film = updateFilmStatusLocal(id, status, extra);
      results.success.push(film);
    } catch (err) {
      results.failed.push({ id, message: err.message || 'Lỗi' });
      results.failedCount += 1;
    }
  }
  const ok = results.success.length;
  const label =
    status === 'processing'
      ? 'bắt đầu tráng'
      : status === 'completed'
        ? 'hoàn thành'
        : status === 'delivered'
          ? 'trả ảnh'
          : 'cập nhật';
  results.message = `Đã ${label} ${ok} phiếu${results.failedCount ? `, ${results.failedCount} lỗi` : ''}`;
  return results;
}

/** Merge backup từ Mac — giữ bản máy mới hơn. */
export function mergeLabFilmsFromServer(serverFilms = []) {
  if (!Array.isArray(serverFilms) || serverFilms.length === 0) return;
  const local = loadLabFilms();
  const byId = new Map(local.map((f) => [String(f._id), f]));

  for (const film of serverFilms) {
    const id = String(film._id || '');
    if (!id) continue;
    const existing = byId.get(id);
    const serverAt = toTime(film.updatedAt || film.updated_at);
    const localAt = existing ? toTime(existing.updatedAt || existing.updated_at) : 0;
    if (!existing || serverAt >= localAt) {
      byId.set(id, { ...existing, ...film, _id: id, _local: false });
    }
  }

  saveLabFilms([...byId.values()]);
}
