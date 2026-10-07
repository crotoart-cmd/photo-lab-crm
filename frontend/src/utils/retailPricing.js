/** Giá sàn = giá nhập; giá bán gợi ý ~38% trên vốn */
export function suggestFromCost(cost) {
  const c = Number(cost) || 0;
  if (c <= 0) return { cost: 0, price: 0, floor_price: 0 };
  return {
    cost: c,
    price: Math.round(c * 1.38),
    floor_price: c,
  };
}

export function resolveFloorPrice(cost, floorPrice) {
  const c = Number(cost) || 0;
  const f = Number(floorPrice);
  if (f > 0) return f;
  return c;
}

export function displayNum(v) {
  if (v === 0 || v === '0' || v == null || v === '') return '';
  return v;
}

/** Giữ chuỗi rỗng khi xóa — tránh num('') → 0 trên mobile */
export function parseNumericInput(raw) {
  if (raw === '' || raw == null) return '';
  const n = Number(raw);
  return Number.isFinite(n) ? n : '';
}

/** Parse ô offer có dấu chấm ngăn cách (10.465.000 → 10465000) */
export function parseOfferInput(raw) {
  if (raw === '' || raw == null) return '';
  const digits = String(raw).replace(/[^\d]/g, '');
  if (digits === '') return '';
  const n = Number(digits);
  return Number.isFinite(n) ? n : '';
}

/** Hiển thị offer trong input — 10465000 → 10.465.000 */
export function formatOfferInput(value) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Math.round(n).toLocaleString('vi-VN');
}

export function offerDisplay(offer, listPrice) {
  if (offer === '' || offer == null) return '';
  if (offer === 0 && listPrice) return '';
  return offer ?? listPrice ?? '';
}

/** Tiền VND — nbsp trước ₫ để không bị xuống dòng lẻ "đ" */
export function fmtMoney(n) {
  return `${Number(n || 0).toLocaleString('vi-VN')}\u00a0₫`;
}

function compactDecimal(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 100) return Math.round(v).toLocaleString('vi-VN');
  if (v >= 10) {
    const scaled = Math.floor(v * 10 + 1e-9) / 10;
    return scaled.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  }
  const scaled = Math.floor(v * 100 + 1e-9) / 100;
  return scaled.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Rút gọn theo đơn vị — dùng cho LN, meta */
export function fmtMoneyShort(n) {
  const v = Math.abs(Number(n) || 0);
  const sign = Number(n) < 0 ? '−' : '';
  if (!v) return '0';
  if (v >= 1_000_000_000_000) return `${sign}${compactDecimal(v / 1_000_000_000_000)} nghìn tỉ`;
  if (v >= 1_000_000_000) return `${sign}${compactDecimal(v / 1_000_000_000)} tỉ`;
  if (v >= 1_000_000) return `${sign}${compactDecimal(v / 1_000_000)} tr`;
  if (v >= 10_000) return `${sign}${Math.round(v / 1_000)}k`;
  return `${sign}${Math.round(v).toLocaleString('vi-VN')}`;
}

/**
 * Hiển thị tiền trên UI mobile — đủ số khi ngắn, tự rút gọn tr/tỉ khi quá dài.
 * @param {{ bar?: boolean }} [opts] — bar: true → thanh checkout (rút gọn từ 1 triệu)
 */
export function fmtMoneyDisplay(n, opts = {}) {
  const v = Math.abs(Number(n) || 0);
  const sign = Number(n) < 0 ? '−' : '';
  if (!v) return `0\u00a0₫`;

  const minCompact = opts.bar ? 100_000_000 : 10_000_000;
  const full = `${Math.round(v).toLocaleString('vi-VN')}\u00a0₫`;
  const needsCompact = v >= minCompact || full.length > 13;
  if (!needsCompact) return `${sign}${full}`;

  if (v >= 1_000_000_000_000) {
    return `${sign}${compactDecimal(v / 1_000_000_000_000)} nghìn tỉ`;
  }
  if (v >= 1_000_000_000) {
    return `${sign}${compactDecimal(v / 1_000_000_000)} tỉ`;
  }
  return `${sign}${compactDecimal(v / 1_000_000)} tr`;
}

export function fmtMoneyDisplayBar(n) {
  return fmtMoneyDisplay(n, { bar: true });
}

/** Có đang dùng dạng rút gọn không (để hiện tooltip số đầy đủ) */
export function isMoneyCompact(n, opts = {}) {
  const v = Math.abs(Number(n) || 0);
  if (!v) return false;
  const minCompact = opts.bar ? 100_000_000 : 10_000_000;
  const full = `${Math.round(v).toLocaleString('vi-VN')}\u00a0₫`;
  return v >= minCompact || full.length > 13;
}
