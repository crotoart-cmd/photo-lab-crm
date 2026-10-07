const CAMERA_STATUSES = ['Cho_Sua', 'Dang_Sua', 'San_Hang', 'Da_Ban'];

const SALABLE_STATUSES = ['San_Hang'];

const CONDITION_GRADES = ['A', 'B', 'C', 'Parts'];

const DEFECT_TAGS = [
  { id: 'fungus', label: 'Mốc kính' },
  { id: 'light_leak', label: 'Hở sáng' },
  { id: 'jam', label: 'Kẹt cơ' },
  { id: 'shutter', label: 'Hỏng shutter' },
  { id: 'meter', label: 'Hỏng đo sáng' },
  { id: 'scratch', label: 'Xước body' },
  { id: 'viewfinder', label: 'Hỏng viewfinder' },
  { id: 'other', label: 'Lỗi khác' },
];

const DEFECT_RE = /lỗi|hỏng|defect|scratch|fungus|jam|stuck|mốc|xước|kẹt/i;

const STATUS_LABELS = {
  Cho_Sua: 'Chờ sửa',
  Dang_Sua: 'Đang sửa',
  San_Hang: 'Sẵn hàng',
  Da_Ban: 'Đã bán',
};

module.exports = {
  CAMERA_STATUSES,
  SALABLE_STATUSES,
  CONDITION_GRADES,
  DEFECT_TAGS,
  DEFECT_RE,
  STATUS_LABELS,
};
