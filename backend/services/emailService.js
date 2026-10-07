const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');
const { buildRetailInvoiceHtml } = require('../templates/retailInvoiceEmail');
const { buildFilmReceiptEmailHtml } = require('../templates/filmReceiptEmail');
const {
  buildRepairIntakeEmailHtml,
  buildRepairQuoteEmailHtml,
  buildRepairReadyEmailHtml,
} = require('../templates/repairServiceEmail');
const { BRAND_NAME, getLogoAttachment, brandSubject } = require('./emailBranding');
const { customerForEmail } = require('../utils/customerNormalize');

let transporter = null;

const escapeHtmlForNote = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const normalizeAppPassword = (raw) => String(raw || '').replace(/\s+/g, '');

const isEmailConfigured = () =>
  Boolean(process.env.EMAIL_USER && normalizeAppPassword(process.env.EMAIL_PASSWORD));

const getTransporter = () => {
  if (!isEmailConfigured()) return null;
  const pass = normalizeAppPassword(process.env.EMAIL_PASSWORD);
  if (pass.length !== 16 && /@gmail\.com$/i.test(process.env.EMAIL_USER || '')) {
    console.warn(
      `⚠️ EMAIL_PASSWORD có ${pass.length} ký tự (Gmail App Password cần đúng 16). Email sẽ lỗi 535.`
    );
  }
  if (!transporter) {
    const useGmail =
      !process.env.EMAIL_HOST ||
      process.env.EMAIL_HOST === 'smtp.gmail.com' ||
      /@gmail\.com$/i.test(process.env.EMAIL_USER || '');

    transporter = useGmail
      ? nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass,
          },
        })
      : nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: Number(process.env.EMAIL_PORT) || 587,
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass,
          },
        });
  }
  return transporter;
};

/** Chỉ chuyển hướng khi EMAIL_TEST_REDIRECT=true — gửi production tới email khách thật */
const isTestRedirectActive = () =>
  /^(1|true|yes)$/i.test(String(process.env.EMAIL_TEST_REDIRECT || '').trim()) &&
  Boolean((process.env.TEST_EMAIL_TO || '').trim());

const resolveRecipient = (intendedTo) => {
  if (!isTestRedirectActive()) return intendedTo;
  const override = (process.env.TEST_EMAIL_TO || '').trim();
  if (override.toLowerCase() !== String(intendedTo || '').toLowerCase()) {
    console.log(`📧 [TEST_EMAIL_TO] ${intendedTo || '(trống)'} → ${override}`);
  }
  return override;
};

const logEmail = async ({
  filmId,
  repairTicketId,
  customerId,
  recipientEmail,
  emailType,
  subject,
  body,
  status,
  error,
}) => {
  if (!filmId && !repairTicketId) return;
  try {
    await EmailLog.create({
      filmId,
      repairTicketId,
      customerId,
      recipientEmail,
      emailType,
      subject,
      body,
      status,
      error,
    });
  } catch (err) {
    console.error('Failed to log email:', err.message);
  }
};

const sendMail = async ({
  to,
  subject,
  html,
  filmId,
  repairTicketId,
  customerId,
  emailType,
  attachments,
}) => {
  const transport = getTransporter();
  const actualTo = resolveRecipient(to);

  if (!transport) {
    console.log(`📧 [Email skipped - not configured] To: ${actualTo} | ${subject}`);
    return { sent: false, skipped: true };
  }

  if (!actualTo) {
    return { sent: false, error: 'Không có địa chỉ nhận' };
  }

  const logoAttachment = getLogoAttachment();
  const mailAttachments = [...(logoAttachment ? [logoAttachment] : []), ...(attachments || [])];
  const testNote =
    actualTo !== to && to
      ? `<p style="margin:0 0 16px;padding:10px;background:#fff8e1;border-left:4px solid #ffb300;font-size:12px;color:#555;">
          <strong>Chế độ test:</strong> Email này gửi tới <strong>${escapeHtmlForNote(actualTo)}</strong>
          (khách trên phiếu: ${escapeHtmlForNote(to)}).
        </p>`
      : '';
  const htmlWithTestNote = testNote ? testNote + html : html;

  try {
    await transport.sendMail({
      from: `"${BRAND_NAME}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: actualTo,
      subject,
      html: htmlWithTestNote,
      attachments: mailAttachments,
    });
    await logEmail({
      filmId,
      repairTicketId,
      customerId,
      recipientEmail: actualTo,
      emailType,
      subject,
      body: html,
      status: 'sent',
    });
    return { sent: true, to: actualTo };
  } catch (error) {
    console.error('Email send error:', error.message);
    await logEmail({
      filmId,
      repairTicketId,
      customerId,
      recipientEmail: actualTo,
      emailType,
      subject,
      body: htmlWithTestNote,
      status: 'failed',
      error: error.message,
    });
    return { sent: false, error: error.message };
  }
};

/**
 * Gửi email phiếu tiếp nhận — HTML trùng nội dung UI TicketSlip (film phải populate customerId).
 */
const sendConfirmationEmail = async (film) => {
  const customer = customerForEmail(film.customerId);
  const to = customer?.email;
  if (!to) return { sent: false, error: 'Khách hàng chưa có email' };

  const ticketNumber = film.ticketNumber || film.filmCode;
  const subject = brandSubject(`Phiếu tiếp nhận film - ${ticketNumber}`);
  const html = buildFilmReceiptEmailHtml(film, customer);

  return sendMail({
    to,
    subject,
    html,
    filmId: film._id,
    customerId: customer._id || customer,
    emailType: 'confirmation',
  });
};

const sendCompletionEmail = async (
  email,
  firstName,
  ticketNumber,
  filmId,
  customerId,
  deliveryGalleryUrl,
  options = {}
) => {
  const { buildServiceNoticeEmail, escapeHtml } = require('../templates/emailLayout');
  const { linkKind = 'local', fallbackGalleryUrl = null } = options;
  const isDrive = linkKind === 'drive';
  const subject = brandSubject(`Ảnh scan đã sẵn sàng - ${ticketNumber}`);

  const buttonLabel = isDrive ? 'Tải toàn bộ album ảnh scan' : 'Xem &amp; tải ảnh scan';

  const linkHtml = deliveryGalleryUrl
    ? `<p style="margin:14px 0 0;">
        <a href="${escapeHtml(deliveryGalleryUrl)}" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">${buttonLabel}</a>
      </p>
      <p style="margin:10px 0 0;font-size:11px;color:#888;word-break:break-all;">${escapeHtml(deliveryGalleryUrl)}</p>`
    : '';

  const retentionNote = isDrive
    ? `<p style="margin:12px 0 0;font-size:12px;color:#666;line-height:1.5;">
        Album được lưu trên cloud riêng cho phiếu của bạn. Vui lòng tải về máy sớm — link có thể hết hạn sau khoảng <strong>30 ngày</strong>.
      </p>`
    : '';

  const fallbackHtml =
    isDrive && fallbackGalleryUrl && fallbackGalleryUrl !== deliveryGalleryUrl
      ? `<p style="margin:12px 0 0;font-size:12px;color:#666;">
          Xem trước trên web lab:
          <a href="${escapeHtml(fallbackGalleryUrl)}" style="color:#111;">${escapeHtml(fallbackGalleryUrl)}</a>
        </p>`
      : '';

  const paragraphs = isDrive
    ? [
        `Phiếu <strong>${ticketNumber}</strong> đã tráng và scan xong.`,
        `Do dung lượng ảnh chất lượng cao, ${BRAND_NAME} đã đồng bộ album lên Google Drive — bấm nút bên dưới để tải về (không gửi file đính kèm qua email).`,
      ]
    : [
        `Phiếu <strong>${ticketNumber}</strong> đã tráng xong. Ảnh scan của bạn đã được đưa lên hệ thống.`,
        'Bấm nút bên dưới để mở thư mục ảnh và tải về máy.',
      ];

  const html = buildServiceNoticeEmail({
    eyebrow: 'ẢNH SCAN ĐÃ SẴN SÀNG',
    customerName: firstName,
    paragraphs,
    callout: {
      title: isDrive ? 'Album ảnh trên Google Drive' : 'Link thư mục ảnh',
      body: `${isDrive ? 'Link tải album:' : 'Thư mục riêng cho phiếu của bạn:'}${linkHtml}${retentionNote}${fallbackHtml}`,
    },
  });
  return sendMail({ to: email, subject, html, filmId, customerId, emailType: 'completion' });
};

const sendRetailInvoiceEmail = async ({
  to,
  customerName = 'Quý khách',
  orderCode,
  lines,
  includeWarranty = false,
}) => {
  const subject = includeWarranty
    ? brandSubject(`Phiếu bán hàng & bảo hành - ${orderCode}`)
    : brandSubject(`Phiếu bán hàng - ${orderCode}`);
  const html = buildRetailInvoiceHtml({
    customerName,
    orderCode,
    lines,
    includeWarranty,
  });
  return sendMail({ to, subject, html, emailType: includeWarranty ? 'sale_warranty' : 'sale_receipt' });
};

const sendDeliveryEmail = async (email, firstName, ticketNumber, filmId, customerId) => {
  const { buildServiceNoticeEmail } = require('../templates/emailLayout');
  const subject = brandSubject(`Đã trả ảnh - ${ticketNumber}`);
  const html = buildServiceNoticeEmail({
    eyebrow: 'XÁC NHẬN ĐÃ TRẢ ẢNH',
    customerName: firstName,
    paragraphs: [
      `${BRAND_NAME} đã <strong>xác nhận trả ảnh</strong> cho phiếu <strong>${ticketNumber}</strong>.`,
      'Cảm ơn bạn đã sử dụng dịch vụ. Hẹn gặp lại bạn!',
    ],
  });
  return sendMail({ to: email, subject, html, filmId, customerId, emailType: 'delivery' });
};

const formatEmailNote = (emailResult) => {
  if (!emailResult) return '';
  if (emailResult.skipped) return ' (email chưa cấu hình SMTP)';
  if (emailResult.sent) return ' — đã gửi email cho khách';
  if (emailResult.error) return ` (gửi email lỗi: ${emailResult.error})`;
  return '';
};

function repairFrontendBase() {
  return require('../config/brand').getFrontendUrl();
}

const sendRepairIntakeEmail = async (ticket) => {
  const to = ticket.customer_email;
  if (!to) return { sent: false, error: 'Khách chưa có email' };
  const subject = brandSubject(`Tiếp nhận sửa máy - ${ticket.ticket_number}`);
  const html = buildRepairIntakeEmailHtml(ticket.toObject ? ticket.toObject() : ticket);
  return sendMail({
    to,
    subject,
    html,
    repairTicketId: ticket._id,
    customerId: ticket.customerId,
    emailType: 'repair_intake',
  });
};

const sendRepairQuoteEmail = async (ticket) => {
  const to = ticket.customer_email;
  if (!to) return { sent: false, error: 'Khách chưa có email' };
  if (!ticket.confirm_token) return { sent: false, error: 'Chưa có mã xác nhận' };
  const base = repairFrontendBase();
  const confirmUrl = `${base}/repair/confirm/${ticket.confirm_token}?action=accept`;
  const declineUrl = `${base}/repair/confirm/${ticket.confirm_token}?action=decline`;
  const subject = brandSubject(`Báo giá sửa máy - ${ticket.ticket_number}`);
  const html = buildRepairQuoteEmailHtml(ticket.toObject ? ticket.toObject() : ticket, {
    confirmUrl,
    declineUrl,
  });
  return sendMail({
    to,
    subject,
    html,
    repairTicketId: ticket._id,
    customerId: ticket.customerId,
    emailType: 'repair_quote',
  });
};

const sendRepairReadyEmail = async (ticket) => {
  const to = ticket.customer_email;
  if (!to) return { sent: false, error: 'Khách chưa có email' };
  const subject = brandSubject(`Máy sẵn sàng trả - ${ticket.ticket_number}`);
  const html = buildRepairReadyEmailHtml(ticket.toObject ? ticket.toObject() : ticket);
  return sendMail({
    to,
    subject,
    html,
    repairTicketId: ticket._id,
    customerId: ticket.customerId,
    emailType: 'repair_ready',
  });
};

const verifySmtp = async () => {
  if (!isEmailConfigured()) {
    return { ok: false, configured: false, message: 'Chưa cấu hình EMAIL_USER / EMAIL_PASSWORD trong .env' };
  }
  const pass = normalizeAppPassword(process.env.EMAIL_PASSWORD);
  if (pass.length !== 16) {
    return {
      ok: false,
      configured: true,
      message: `Mật khẩu ứng dụng có ${pass.length} ký tự — Gmail cần đúng 16 (ghép 4 nhóm, bỏ khoảng trắng)`,
    };
  }
  try {
    const transport = getTransporter();
    await transport.verify();
    return { ok: true, configured: true, message: 'SMTP Gmail kết nối OK' };
  } catch (error) {
    return { ok: false, configured: true, message: error.message };
  }
};

const resetTransporter = () => {
  transporter = null;
};

module.exports = {
  sendConfirmationEmail,
  sendCompletionEmail,
  sendDeliveryEmail,
  sendRetailInvoiceEmail,
  sendRepairIntakeEmail,
  sendRepairQuoteEmail,
  sendRepairReadyEmail,
  sendMail,
  isEmailConfigured,
  formatEmailNote,
  verifySmtp,
  resetTransporter,
  normalizeAppPassword,
  resolveRecipient,
  isTestRedirectActive,
};
