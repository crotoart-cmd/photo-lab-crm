/** Shop public = USD (base Mỹ). Kho lưu VNĐ. */
export const USD_VND = 25_000;

export function vndToUsd(vnd) {
  const n = Number(vnd) || 0;
  return Math.round((n / USD_VND) * 100) / 100;
}

export function formatUsd(usd) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(usd) || 0);
}

export function formatVndExact(vnd) {
  return `${Math.round(Number(vnd) || 0).toLocaleString('vi-VN')}đ`;
}

/** Trang khách — chỉ đô. */
export function formatShopPublicPrice(vnd) {
  return formatUsd(vndToUsd(vnd));
}

/** Admin — Việt Nam kèm Mỹ. */
export function formatShopAdminPrice(vnd) {
  return `${formatVndExact(vnd)} · ${formatUsd(vndToUsd(vnd))}`;
}
