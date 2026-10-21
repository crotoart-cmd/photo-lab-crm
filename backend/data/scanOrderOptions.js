const SCAN_METHODS = [
  { value: 'hiend', label: 'Scan hi-end' },
  { value: 'batch', label: 'Scan hàng loạt' },
];

const SCAN_SOURCES = [
  { value: 'negative', label: 'Negative đã tráng' },
  { value: 'lab_roll', label: 'Lab đang giữ cuộn' },
];

const SCAN_FORMATS = [
  { value: '35mm', label: '135' },
  { value: '120', label: '120' },
  { value: 'other', label: 'Khác (Polaroid, kính, A3…)' },
];

const SCAN_SIZES = [
  { value: 's', label: 'Size S' },
  { value: 'm', label: 'Size M' },
  { value: 'l', label: 'Size L' },
  { value: 'hiend', label: 'Hi-end 5000 dpi' },
];

const SCAN_OUTPUTS = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'tiff', label: 'TIFF' },
  { value: 'both', label: 'JPEG + TIFF' },
];

const SCAN_DELIVERY = [
  { value: 'pickup', label: 'Nhận tại lab' },
  { value: 'ship', label: 'Ship negative' },
];

module.exports = {
  SCAN_METHODS,
  SCAN_SOURCES,
  SCAN_FORMATS,
  SCAN_SIZES,
  SCAN_OUTPUTS,
  SCAN_DELIVERY,
};
