const PRINT_METHODS = [
  { value: 'optical', label: 'Rọi analog' },
  { value: 'inkjet', label: 'In giấy ảnh' },
];

const PRINT_SOURCES = [
  { value: 'negative', label: 'Negative đã tráng' },
  { value: 'lab_scan', label: 'Lab đã scan cuộn này' },
  { value: 'files', label: 'File ảnh' },
];

const PRINT_SIZES = [
  { value: '10x15', label: '10 × 15 cm' },
  { value: '13x18', label: '13 × 18 cm' },
  { value: '20x30', label: '20 × 30 cm' },
  { value: '30x40', label: '30 × 40 cm' },
  { value: '40x60', label: '40 × 60 cm' },
  { value: 'max', label: 'Tới 1 × 1,5 m' },
  { value: 'custom', label: 'Khổ riêng' },
];

const PRINT_PAPERS = [
  { value: 'ilford', label: 'Ilford (rọi analog)' },
  { value: 'fuji', label: 'Fuji (rọi analog)' },
  { value: 'glossy', label: 'Glossy — bóng' },
  { value: 'matte', label: 'Matte — nhám' },
];

const PRINT_FILE_HANDOFF = [
  { value: 'link', label: 'Link Drive / WeTransfer' },
  { value: 'usb', label: 'Mang USB tới lab' },
  { value: 'later', label: 'Gửi file sau' },
];

const PRINT_DELIVERY = [
  { value: 'pickup', label: 'Nhận tại lab' },
  { value: 'ship', label: 'Ship' },
];

module.exports = {
  PRINT_METHODS,
  PRINT_SOURCES,
  PRINT_SIZES,
  PRINT_PAPERS,
  PRINT_FILE_HANDOFF,
  PRINT_DELIVERY,
};
