export const LAB_PAGE_SIZE = 15;

export function formatLabRelative(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

export function ticketMark(code) {
  const text = String(code || '').replace(/\s/g, '');
  return text.slice(-3).toUpperCase() || '•';
}
