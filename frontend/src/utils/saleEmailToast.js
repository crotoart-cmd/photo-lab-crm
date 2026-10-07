/** Ghi chú email trên toast sau bán hàng (POS / bán thủ công). */
export function formatSaleEmailToastNote(data = {}) {
  if (data.emailSent) {
    const dest = data.emailSentTo ? ` tới ${data.emailSentTo}` : '';
    return ` — đã gửi phiếu bán hàng qua email${dest}`;
  }
  if (data.emailError) return ` (gửi email lỗi: ${data.emailError})`;
  if (data.emailSkipped) {
    if (data.emailSkippedReason === 'no-buyer-email') {
      return ' (chưa có email khách — nhập ô Email phiếu bán hàng)';
    }
    return ' (chưa cấu hình SMTP — vào Hồ sơ → Gửi email từ máy)';
  }
  if (data.emailPending) {
    return ` — ${data.serverSyncError || 'chưa gửi được email, sẽ thử lại khi kết nối Mac'}`;
  }
  return '';
}

export function buildSaleSuccessToast({ title, subtitle, email, durationMs }) {
  const note = formatSaleEmailToastNote(email);
  return {
    title,
    message: `${subtitle}${note}`,
    durationMs: durationMs ?? (note ? 5500 : 3000),
  };
}
