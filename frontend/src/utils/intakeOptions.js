export const FILM_FORMATS = [
  { value: '35mm', label: '35mm (135)' },
  { value: '120', label: '120 — Medium Format' },
  { value: '110', label: '110' },
  { value: 'other', label: 'Khác' },
];

export const FILM_TYPE_DETAILS = [
  { value: 'color_negative', label: 'Phim âm bản màu (Color Negative)' },
  { value: 'black_white', label: 'Phim trắng đen (B&W)' },
  { value: 'slide_e6', label: 'Phim dương bản (Slide / E-6)' },
];

export const PROCESSING_PROCESSES = [
  { value: 'c41', label: 'C-41 (màu chuẩn)' },
  { value: 'ecn2', label: 'ECN-2 (phim điện ảnh)' },
  { value: 'bw_standard', label: 'B&W — quy trình chuẩn' },
  { value: 'bw_custom', label: 'B&W — quy trình riêng' },
  { value: 'e6', label: 'E-6 (Slide)' },
  { value: 'other', label: 'Khác' },
];

export const LEADER_STATUS = [
  { value: 'wound_in_core', label: 'Đã thu hẳn vào lõi' },
  { value: 'leader_out', label: 'Còn đầu phim (leader) chừa ra ngoài' },
  { value: 'unknown', label: 'Chưa xác định' },
];

export const CANISTER_CONDITIONS = [
  { value: 'ok', label: 'Bình thường' },
  { value: 'dented', label: 'Vỏ móp méo' },
  { value: 'rusty', label: 'Vỏ rỉ sét' },
  { value: 'broken_light_leak', label: 'Vỏ bể / lọt sáng (120)' },
  { value: 'other', label: 'Khác' },
];

export const FILM_STUCK = [
  { value: 'no', label: 'Không' },
  { value: 'yes_customer_reported', label: 'Có — khách báo đứt/kẹt' },
  { value: 'yes_found_on_inspection', label: 'Có — phát hiện khi kiểm tra' },
];

export const WET_MOLD = [
  { value: 'no', label: 'Không' },
  { value: 'suspected', label: 'Nghi ngờ ẩm/mốc' },
  { value: 'yes', label: 'Có dấu hiệu ẩm/mốc' },
];

export const ISO_HANDLING = [
  { value: 'box_speed', label: 'Đúng ISO gốc (box speed)' },
  { value: 'push', label: 'Push (tăng ISO / tăng sáng)' },
  { value: 'pull', label: 'Pull (giảm ISO / giảm sáng)' },
];

export const CUT_FILM = [
  { value: 'cut_strips', label: 'Cắt thành từng dải' },
  { value: 'leave_roll', label: 'Để nguyên cuộn' },
  { value: 'undecided', label: 'Chưa quyết định' },
];

export const SCAN_FORMATS = [
  { value: 'jpeg', label: 'JPEG (tiêu chuẩn)' },
  { value: 'tiff', label: 'TIFF (hậu kỳ)' },
  { value: 'both', label: 'Cả JPEG + TIFF' },
];

export const SCAN_RESOLUTIONS = [
  { value: 's', label: 'Size S' },
  { value: 'm', label: 'Size M' },
  { value: 'l', label: 'Size L' },
  { value: 'custom', label: 'Tùy chỉnh' },
];

export const COLOR_TONES = [
  { value: 'natural', label: 'Tự nhiên (Frontier/Noritsu)' },
  { value: 'warm', label: 'Tông ấm' },
  { value: 'cool', label: 'Tông lạnh' },
  { value: 'high_contrast', label: 'Tương phản cao' },
  { value: 'custom', label: 'Tùy chỉnh' },
];

export const ORIGINAL_RETURN = [
  { value: 'pickup_at_lab', label: 'Qua lab lấy binder' },
  { value: 'ship_home', label: 'Ship tận nhà' },
  { value: 'discard', label: 'Hủy film (không lưu)' },
  { value: 'undecided', label: 'Chưa quyết định' },
];

export const PAYMENT_STATUS = [
  { value: 'paid_full', label: 'Đã thanh toán đủ' },
  { value: 'deposit', label: 'Đã cọc / thanh toán một phần' },
  { value: 'unpaid', label: 'Chưa thanh toán' },
];

export const labelOf = (options, value) => options.find((o) => o.value === value)?.label || value || '—';

export const defaultIntakeChecklist = () => ({
  filmFormat: '35mm',
  filmFormatNote: '',
  filmTypeDetail: 'color_negative',
  processingProcess: 'c41',
  processingProcessNote: '',
  leaderStatus: 'wound_in_core',
  canisterCondition: 'ok',
  canisterConditionNote: '',
  filmStuckBroken: 'no',
  filmStuckBrokenNote: '',
  wetMold: 'no',
  wetMoldNote: '',
  isoHandling: 'box_speed',
  isoValue: '',
  pushPullStops: '',
  cutFilm: 'cut_strips',
  scanFileFormat: 'jpeg',
  scanResolution: 'm',
  scanResolutionNote: '',
  colorTone: 'natural',
  colorToneNote: '',
  technicalNotes: '',
  contactVerified: false,
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  promisedReturnAt: '',
  originalFilmReturn: 'pickup_at_lab',
  shippingAddress: '',
  paymentStatus: 'unpaid',
  paymentAmount: '',
  paymentNote: '',
  inspectedBy: '',
});

export const filmTypeFromDetail = (detail) => {
  const map = { color_negative: 'color', black_white: 'black_white', slide_e6: 'slide' };
  return map[detail] || 'color';
};
