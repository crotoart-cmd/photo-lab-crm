const { BRAND_NAME } = require('../config/brand');
const {
  buildEmailLayout,
  buildCalloutHtml,
  escapeHtml,
  formatVND,
} = require('./emailLayout');

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  } catch {
    return String(d);
  }
};

const detailRow = (label, value) => {
  const v = value != null && value !== '' && value !== '—' ? escapeHtml(value) : '';
  if (!v) return '';
  return `<tr>
    <td style="padding:8px 0;color:#64748b;font-size:13px;width:40%;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;color:#111;">${v}</td>
  </tr>`;
};

function buildRepairIntakeEmailHtml(ticket) {
  const t = ticket.ticket_number;
  const received = fmtDate(ticket.received_at || ticket.createdAt);
  const name = ticket.customer_name || '—';
  const phone = ticket.customer_phone || '—';
  const emailAddr = ticket.customer_email || '—';

  const summaryTable = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
      ${detailRow('Mã phiếu', t)}
      ${detailRow('Ngày tiếp nhận', received)}
      ${detailRow('Máy', ticket.model_name)}
      ${ticket.brand ? detailRow('Hãng', ticket.brand) : ''}
      ${ticket.serial_number ? detailRow('Sê-ri', ticket.serial_number) : ''}
      ${detailRow('Triệu chứng', ticket.symptom)}
      ${ticket.condition_at_intake ? detailRow('Tình trạng lúc nhận', ticket.condition_at_intake) : ''}
    </table>
    ${
      ticket.intake_note
        ? `<p style="margin-top:12px;font-size:13px;color:#555;"><strong>Ghi chú:</strong> ${escapeHtml(ticket.intake_note)}</p>`
        : ''
    }`;

  return buildEmailLayout({
    eyebrow: 'PHIẾU TIẾP NHẬN SỬA MÁY',
    greeting: `Xin chào ${name},`,
    introHtml: `<p style="margin:0;">${escapeHtml(BRAND_NAME)} đã tiếp nhận máy ảnh của bạn để kiểm tra và sửa chữa. Vui lòng giữ mã phiếu bên dưới khi liên hệ hoặc đến lấy máy.</p>`,
    metaLeftHtml: `<strong style="color:#111;">MÃ PHIẾU:</strong> ${escapeHtml(t)}<br/><strong style="color:#111;">Ngày:</strong> ${escapeHtml(received)}`,
    metaRightHtml: `<strong style="color:#111;">KHÁCH HÀNG:</strong><br/>${escapeHtml(name)}<br/>${escapeHtml(phone)}<br/>${escapeHtml(emailAddr)}`,
    bodyHtml: summaryTable,
    calloutHtml: buildCalloutHtml(
      'Tiếp theo',
      'Sau khi kiểm tra, bạn sẽ nhận <strong>email báo giá</strong> để xác nhận trước khi tiệm tiến hành sửa.'
    ),
  });
}

function buildRepairQuoteEmailHtml(ticket, { confirmUrl, declineUrl }) {
  const name = ticket.customer_name || 'Quý khách';
  const lines = (ticket.quote_lines || [])
    .map(
      (line) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;color:#333;">${escapeHtml(line.label)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:600;text-align:right;">${formatVND(line.amount)}</td>
        </tr>`
    )
    .join('');

  const quoteTable = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${lines}
      <tr>
        <td style="padding:12px 0;font-size:14px;font-weight:700;color:#111;">Tổng báo giá</td>
        <td style="padding:12px 0;font-size:16px;font-weight:700;text-align:right;color:#111;">${formatVND(ticket.quote_amount)}</td>
      </tr>
      ${
        ticket.deposit_amount > 0
          ? `<tr><td style="padding:4px 0;font-size:12px;color:#666;">Đã cọc</td><td style="text-align:right;font-size:12px;">${formatVND(ticket.deposit_amount)}</td></tr>`
          : ''
      }
    </table>`;

  const actionHtml = `
    <p style="margin:16px 0 0;text-align:center;">
      <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin:4px;">Đồng ý sửa</a>
      <a href="${escapeHtml(declineUrl)}" style="display:inline-block;background:#f1f5f9;color:#334155;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:4px;">Từ chối</a>
    </p>
    <p style="margin:10px 0 0;font-size:11px;color:#888;text-align:center;word-break:break-all;">Link xác nhận hết hạn sau 7 ngày.</p>`;

  return buildEmailLayout({
    eyebrow: 'BÁO GIÁ SỬA MÁY',
    greeting: `Xin chào ${name},`,
    introHtml: `<p style="margin:0;">Chúng tôi đã kiểm tra máy <strong>${escapeHtml(ticket.model_name)}</strong> (phiếu <strong>${escapeHtml(ticket.ticket_number)}</strong>). Vui lòng xác nhận báo giá bên dưới để tiệm bắt đầu sửa.</p>`,
    metaLeftHtml: `<strong style="color:#111;">MÃ PHIẾU:</strong> ${escapeHtml(ticket.ticket_number)}`,
    metaRightHtml: `<strong style="color:#111;">MÁY:</strong><br/>${escapeHtml(ticket.model_name)}${ticket.serial_number ? `<br/>SN: ${escapeHtml(ticket.serial_number)}` : ''}`,
    bodyHtml: `${ticket.quote_note ? `<p style="font-size:13px;color:#555;margin:0 0 12px;">${escapeHtml(ticket.quote_note)}</p>` : ''}${quoteTable}`,
    calloutHtml: buildCalloutHtml('Xác nhận báo giá', actionHtml),
  });
}

function buildRepairReadyEmailHtml(ticket) {
  const name = ticket.customer_name || 'Quý khách';
  const due =
    ticket.final_amount > 0
      ? ticket.final_amount - (ticket.deposit_amount || 0)
      : ticket.quote_amount - (ticket.deposit_amount || 0);

  return buildEmailLayout({
    eyebrow: 'MÁY SẴN SÀNG TRẢ',
    greeting: `Xin chào ${name},`,
    introHtml: `<p style="margin:0;">Máy <strong>${escapeHtml(ticket.model_name)}</strong> (phiếu <strong>${escapeHtml(ticket.ticket_number)}</strong>) đã sửa xong và sẵn sàng trả. Vui lòng đến tiệm để nhận máy.</p>`,
    metaLeftHtml: `<strong style="color:#111;">MÃ PHIẾU:</strong> ${escapeHtml(ticket.ticket_number)}`,
    metaRightHtml: `<strong style="color:#111;">CÒN LẠI:</strong><br/>${formatVND(Math.max(0, due))}`,
    bodyHtml: ticket.intake_note
      ? `<p style="font-size:13px;color:#555;">${escapeHtml(ticket.intake_note)}</p>`
      : '',
    calloutHtml: buildCalloutHtml(
      'Lưu ý',
      'Mang theo mã phiếu hoặc email này khi đến lấy máy. Liên hệ tiệm nếu cần đổi giờ hẹn.'
    ),
  });
}

module.exports = {
  buildRepairIntakeEmailHtml,
  buildRepairQuoteEmailHtml,
  buildRepairReadyEmailHtml,
};
