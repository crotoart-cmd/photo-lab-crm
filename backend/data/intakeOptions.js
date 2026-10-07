/** Nhãn checklist — đồng bộ với frontend/src/utils/intakeOptions.js */
const opt = (value, label) => ({ value, label });

const FILM_FORMATS = [
  opt('35mm', '35mm (135)'),
  opt('120', '120 — Medium Format'),
  opt('110', '110'),
  opt('other', 'Khác'),
];
const FILM_TYPE_DETAILS = [
  opt('color_negative', 'Phim âm bản màu (Color Negative)'),
  opt('black_white', 'Phim trắng đen (B&W)'),
  opt('slide_e6', 'Phim dương bản (Slide / E-6)'),
];
const PROCESSING_PROCESSES = [
  opt('c41', 'C-41 (màu chuẩn)'),
  opt('ecn2', 'ECN-2 (phim điện ảnh)'),
  opt('bw_standard', 'B&W — quy trình chuẩn'),
  opt('bw_custom', 'B&W — quy trình riêng'),
  opt('e6', 'E-6 (Slide)'),
  opt('other', 'Khác'),
];
const LEADER_STATUS = [
  opt('wound_in_core', 'Đã thu hẳn vào lõi'),
  opt('leader_out', 'Còn đầu phim (leader) chừa ra ngoài'),
  opt('unknown', 'Chưa xác định'),
];
const CANISTER_CONDITIONS = [
  opt('ok', 'Bình thường'),
  opt('dented', 'Vỏ móp méo'),
  opt('rusty', 'Vỏ rỉ sét'),
  opt('broken_light_leak', 'Vỏ bể / lọt sáng (120)'),
  opt('other', 'Khác'),
];
const FILM_STUCK = [
  opt('no', 'Không'),
  opt('yes_customer_reported', 'Có — khách báo đứt/kẹt'),
  opt('yes_found_on_inspection', 'Có — phát hiện khi kiểm tra'),
];
const WET_MOLD = [
  opt('no', 'Không'),
  opt('suspected', 'Nghi ngờ ẩm/mốc'),
  opt('yes', 'Có dấu hiệu ẩm/mốc'),
];
const ISO_HANDLING = [
  opt('box_speed', 'Đúng ISO gốc (box speed)'),
  opt('push', 'Push (tăng ISO / tăng sáng)'),
  opt('pull', 'Pull (giảm ISO / giảm sáng)'),
];
const CUT_FILM = [
  opt('cut_strips', 'Cắt thành từng dải'),
  opt('leave_roll', 'Để nguyên cuộn'),
  opt('undecided', 'Chưa quyết định'),
];
const SCAN_FORMATS = [
  opt('jpeg', 'JPEG (tiêu chuẩn)'),
  opt('tiff', 'TIFF (hậu kỳ)'),
  opt('both', 'Cả JPEG + TIFF'),
];
const SCAN_RESOLUTIONS = [
  opt('s', 'Size S'),
  opt('m', 'Size M'),
  opt('l', 'Size L'),
  opt('custom', 'Tùy chỉnh'),
];
const COLOR_TONES = [
  opt('natural', 'Tự nhiên (Frontier/Noritsu)'),
  opt('warm', 'Tông ấm'),
  opt('cool', 'Tông lạnh'),
  opt('high_contrast', 'Tương phản cao'),
  opt('custom', 'Tùy chỉnh'),
];
const ORIGINAL_RETURN = [
  opt('pickup_at_lab', 'Qua lab lấy binder'),
  opt('ship_home', 'Ship tận nhà'),
  opt('discard', 'Hủy film (không lưu)'),
  opt('undecided', 'Chưa quyết định'),
];
const PAYMENT_STATUS = [
  opt('paid_full', 'Đã thanh toán đủ'),
  opt('deposit', 'Đã cọc / thanh toán một phần'),
  opt('unpaid', 'Chưa thanh toán'),
];

const labelOf = (options, value) => options.find((o) => o.value === value)?.label || value || '—';

module.exports = {
  FILM_FORMATS,
  FILM_TYPE_DETAILS,
  PROCESSING_PROCESSES,
  LEADER_STATUS,
  CANISTER_CONDITIONS,
  FILM_STUCK,
  WET_MOLD,
  ISO_HANDLING,
  CUT_FILM,
  SCAN_FORMATS,
  SCAN_RESOLUTIONS,
  COLOR_TONES,
  ORIGINAL_RETURN,
  PAYMENT_STATUS,
  labelOf,
};
