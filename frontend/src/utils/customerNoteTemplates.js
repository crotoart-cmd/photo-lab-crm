/**
 * Mẫu ghi chú nhanh — chỉ dùng trên phần mềm (CRM nội bộ).
 * Nội dung ghi chú KHÔNG được đính kèm / hiển thị trong email gửi cho khách.
 */
export const CUSTOMER_NOTE_TEMPLATES_ARE_INTERNAL = true;

export const CUSTOMER_NOTE_TEMPLATES = [
  'Thích tone ấm',
  'Ưu tiên scan HQ',
  'Gọi sau 18h',
  'Nhạy cảm giá — ưu đãi VIP',
  'Hay tráng C41 push +1',
  'Khách hay ship film về',
  'Máy film vintage — cẩn thận khi cầm',
  'Hay mang nhiều body / lens film',
  'Chủ yếu chụp film 135',
  'Chủ yếu chụp film 120',
  'Nhắc cap lens khi trả máy',
  'Máy có light leak — đã báo khách',
  'Hay quên đóng cửa sáng máy',
  'Khách hay thuê / gửi máy film lâu ngày',
];

export function appendNoteTemplate(currentNotes, template) {
  const base = String(currentNotes || '').trim();
  if (!base) return template;
  if (base.includes(template)) return base;
  return `${base}\n• ${template}`;
}
