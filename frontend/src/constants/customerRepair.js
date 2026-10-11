export const REPAIR_STATUS_LABELS = {
  don_web: 'Đơn web',
  tiep_nhan: 'Đã nhận máy',
  cho_khach_xac_nhan: 'Chờ xác nhận',
  dang_sua: 'Đang sửa',
  cho_tra: 'Chờ trả',
  da_tra: 'Đã trả',
  khach_tu_choi: 'Khách từ chối',
  da_huy: 'Đã hủy',
};

export const REPAIR_STATUS_PILL = {
  don_web: 'warning',
  tiep_nhan: 'active',
  cho_khach_xac_nhan: 'warning',
  dang_sua: 'processing',
  cho_tra: 'success',
  da_tra: 'disable',
  khach_tu_choi: 'failed',
  da_huy: 'failed',
};

export const REPAIR_TABS = [
  { id: '', label: 'Tất cả' },
  { id: 'don_web', label: 'Đơn web' },
  { id: 'tiep_nhan', label: 'Đã nhận máy' },
  { id: 'cho_khach_xac_nhan', label: 'Chờ xác nhận' },
  { id: 'dang_sua', label: 'Đang sửa' },
  { id: 'cho_tra', label: 'Chờ trả' },
  { id: 'da_tra', label: 'Đã trả' },
];

/** Thứ tự ưu tiên hiển thị — đồng bộ backend */
export const REPAIR_STATUS_ORDER = [
  'don_web',
  'tiep_nhan',
  'cho_khach_xac_nhan',
  'dang_sua',
  'cho_tra',
  'da_tra',
  'khach_tu_choi',
  'da_huy',
];

export function sortRepairTickets(tickets) {
  const rank = (status) => {
    const i = REPAIR_STATUS_ORDER.indexOf(status);
    return i === -1 ? REPAIR_STATUS_ORDER.length : i;
  };
  return [...tickets].sort((a, b) => {
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
  });
}

export const formatRepairMoney = (n) =>
  `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;
