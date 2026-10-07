export const STATUS_LABELS = {
  received: 'Tiếp nhận',
  processing: 'Đang tráng',
  completed: 'Sẵn sàng trả',
  delivered: 'Đã trả',
  cancelled: 'Hủy',
};

export const FILM_TYPES = [
  { value: 'color', label: 'Màu (Color)' },
  { value: 'black_white', label: 'Đen trắng' },
  { value: 'slide', label: 'Slide' },
];

export const filmTypeLabel = (value) => FILM_TYPES.find((t) => t.value === value)?.label || value;

export const ticketCode = (film) => film.ticketNumber || film.filmCode;

export const customerName = (film) => {
  const c = film.customerId;
  if (!c || typeof c !== 'object') return '—';
  return `${c.firstName} ${c.lastName}`;
};

export const customerPhone = (film) => film.customerId?.phone || '—';
export const customerEmail = (film) => film.customerId?.email || '—';

export const FILM_STATUS_PILL = {
  received: 'active',
  processing: 'processing',
  completed: 'success',
  delivered: 'disable',
  cancelled: 'failed',
};

export const statusColors = {
  received: 'bg-sky-100 text-sky-700',
  processing: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  delivered: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-700',
};
