/** Ngưỡng rút gọn: từ 10 triệu (hàng chục triệu) trở lên */
export const VND_COMPACT_THRESHOLD = 10_000_000;

/** Luôn hiển thị đủ — dùng cho POS, hóa đơn, nhập liệu */
export function formatVndFull(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;
}

/** Alias — giữ tương thích chỗ cần số đủ */
export function formatMoney(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('vi-VN')} đ`;
}

/**
 * Hiển thị tiền UI:
 * - dưới 10 triệu: đủ (vd. 5.000.000đ)
 * - ≥ 10 triệu: rút gọn (vd. 12tr, 10,5tr)
 */
export function formatVnd(n) {
  const amount = Math.round(Number(n) || 0);
  if (amount >= VND_COMPACT_THRESHOLD) {
    const tr = amount / 1_000_000;
    const trStr = Number.isInteger(tr)
      ? tr.toLocaleString('vi-VN')
      : tr.toFixed(1).replace('.', ',');
    return `${trStr}tr`;
  }
  return formatVndFull(amount);
}

/** Parse chuỗi đã format hoặc số → formatVnd */
export function formatVndFromValue(value) {
  if (value == null || value === '') return value;
  if (typeof value === 'number') return formatVnd(value);
  const str = String(value);
  const num = Number(str.replace(/[^\d]/g, ''));
  if (!Number.isFinite(num) || num === 0) return str;
  return formatVnd(num);
}
