const REPAIR_STATUSES = [
  'don_web',
  'tiep_nhan',
  'cho_khach_xac_nhan',
  'dang_sua',
  'cho_tra',
  'da_tra',
  'khach_tu_choi',
  'da_huy',
];

const STATUS_LABELS = {
  don_web: 'Đơn web',
  tiep_nhan: 'Đã nhận máy',
  cho_khach_xac_nhan: 'Chờ khách xác nhận',
  dang_sua: 'Đang sửa',
  cho_tra: 'Chờ trả máy',
  da_tra: 'Đã trả',
  khach_tu_choi: 'Khách từ chối',
  da_huy: 'Đã hủy',
};

/** Cho phép ghi nhật ký sửa (chi phí nội bộ) */
const WORKLOG_ALLOWED = ['dang_sua'];

/** Cho phép gửi báo giá */
const QUOTE_ALLOWED = ['tiep_nhan', 'cho_khach_xac_nhan'];

/** Thứ tự ưu tiên hiển thị danh sách (pipeline vận hành) */
const STATUS_DISPLAY_ORDER = [
  'don_web',
  'tiep_nhan',
  'cho_khach_xac_nhan',
  'dang_sua',
  'cho_tra',
  'da_tra',
  'khach_tu_choi',
  'da_huy',
];

module.exports = {
  REPAIR_STATUSES,
  STATUS_LABELS,
  STATUS_DISPLAY_ORDER,
  WORKLOG_ALLOWED,
  QUOTE_ALLOWED,
};
