export const CAMERA_STATUSES = ['Cho_Sua', 'Dang_Sua', 'San_Hang', 'Da_Ban'];

export const STATUS_LABELS = {
  Cho_Sua: 'Chờ sửa',
  Dang_Sua: 'Đang sửa',
  San_Hang: 'Sẵn hàng',
  Da_Ban: 'Đã bán',
};

export const STATUS_BADGE = {
  Cho_Sua: 'camera-badge-warn',
  Dang_Sua: 'camera-badge-info',
  San_Hang: 'camera-badge-ok',
  Da_Ban: 'camera-badge-muted',
};

export const CONDITION_GRADES = [
  { id: 'A', label: 'Đẹp' },
  { id: 'B', label: 'Khá' },
  { id: 'C', label: 'Có lỗi nhẹ' },
  { id: 'Parts', label: 'Part - linh kiện' },
];

export const DEFECT_TAGS = [
  { id: 'fungus', label: 'Mốc kính' },
  { id: 'light_leak', label: 'Hở sáng' },
  { id: 'jam', label: 'Kẹt cơ' },
  { id: 'shutter', label: 'Hỏng shutter' },
  { id: 'meter', label: 'Hỏng đo sáng' },
  { id: 'scratch', label: 'Xước body' },
  { id: 'viewfinder', label: 'Hỏng viewfinder' },
  { id: 'other', label: 'Lỗi khác' },
];

export const DEFECT_RE = /lỗi|hỏng|defect|scratch|fungus|jam|stuck|mốc|xước|kẹt/i;

export function defectTagLabel(id) {
  return DEFECT_TAGS.find((t) => t.id === id)?.label || id;
}

export function cameraHasDefect(camera) {
  if (!camera) return false;
  if (camera.has_defect) return true;
  if (Array.isArray(camera.defect_tags) && camera.defect_tags.length > 0) return true;
  if (camera.condition_grade && camera.condition_grade !== 'A') return true;
  return DEFECT_RE.test(camera.condition_note || '');
}

export function resolveIntakeStatus(payload) {
  const flagged = cameraHasDefect(payload);
  if (!flagged) return 'San_Hang';
  if (payload.force_ready) return 'San_Hang';
  return payload.intake_status === 'Dang_Sua' ? 'Dang_Sua' : 'Cho_Sua';
}

export function computeTrueCost(camera) {
  return Number(camera?.cost || 0) + Number(camera?.total_repair_cost || 0);
}

export const formatVnd = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;
