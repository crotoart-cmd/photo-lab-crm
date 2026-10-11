/** Nội dung dịch vụ trang khách — tiếng Việt, thương hiệu HDTLabx. */

export const SERVICE_TILES = [
  {
    id: 'trang',
    to: '/film',
    title: 'Tráng',
    caption: 'Chất lượng, chú ý từng cuộn',
    tone: 'film',
    enabled: true,
  },
  {
    id: 'toc-do',
    to: '/toc-do',
    title: 'Tốc độ',
    caption: 'Khoảng 2 tuần, không tính Chủ nhật',
    tone: 'speed',
    enabled: true,
  },
  {
    id: 'in-analog',
    to: '/in-analog',
    title: 'In analog',
    caption: 'In tay theo yêu cầu của bạn',
    tone: 'print',
    enabled: true,
  },
  {
    id: 'scan',
    to: '/scan',
    title: 'Scan',
    caption: 'Máy hi-end và scan hàng loạt',
    tone: 'scan',
    enabled: true,
  },
  {
    id: 'cua-hang',
    to: '/cua-hang',
    title: 'Cửa hàng',
    caption: 'Film, máy, phụ kiện, hóa chất',
    tone: 'shop',
    enabled: false,
  },
  {
    id: 'dao-tao',
    to: '/dao-tao',
    title: 'Đào tạo',
    caption: 'Lớp riêng, từng người',
    tone: 'edu',
    enabled: false,
  },
];

export const SPEED_STANDARD = [
  { process: 'C-41', time: '2 tuần' },
  { process: 'B&W', time: '2 tuần' },
  { process: 'ECN-2', time: '2 tuần' },
  { process: 'E-6', time: '2 tuần' },
];
