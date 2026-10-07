import { BRAND_NAME } from '../config/brand';
import { buildServiceNoticeEmail, escapeHtml } from './emailLayout';

function customerFirstName(film) {
  const c = film?.customerId && typeof film.customerId === 'object' ? film.customerId : null;
  const fromContact = film?.intakeChecklist?.contactName;
  if (c?.firstName) return c.firstName;
  if (fromContact) return String(fromContact).split(/\s+/)[0] || fromContact;
  return 'Quý khách';
}

function ticketLabel(film) {
  return film?.ticketNumber || film?.filmCode || 'PH';
}

/** Ảnh scan sẵn sàng — có link nếu máy đã có Drive/gallery. */
export function buildFilmCompletionEmailHtml(film, { galleryUrl, linkKind = 'local' } = {}) {
  const ticketNumber = ticketLabel(film);
  const firstName = customerFirstName(film);
  const isDrive = linkKind === 'drive';
  const buttonLabel = isDrive ? 'Tải toàn bộ album ảnh scan' : 'Xem &amp; tải ảnh scan';

  const linkHtml = galleryUrl
    ? `<p style="margin:14px 0 0;">
        <a href="${escapeHtml(galleryUrl)}" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">${buttonLabel}</a>
      </p>
      <p style="margin:10px 0 0;font-size:11px;color:#888;word-break:break-all;">${escapeHtml(galleryUrl)}</p>`
    : `<p style="margin:8px 0 0;font-size:13px;color:#555;">Lab sẽ gửi / cập nhật link tải ảnh riêng khi album sẵn sàng trên hệ thống.</p>`;

  const paragraphs = galleryUrl
    ? isDrive
      ? [
          `Phiếu <strong>${escapeHtml(ticketNumber)}</strong> đã tráng và scan xong.`,
          `Do dung lượng ảnh chất lượng cao, ${escapeHtml(BRAND_NAME)} đã đồng bộ album lên Google Drive — bấm nút bên dưới để tải về.`,
        ]
      : [
          `Phiếu <strong>${escapeHtml(ticketNumber)}</strong> đã tráng xong. Ảnh scan của bạn đã được đưa lên hệ thống.`,
          'Bấm nút bên dưới để mở thư mục ảnh và tải về máy.',
        ]
    : [
        `Phiếu <strong>${escapeHtml(ticketNumber)}</strong> đã tráng xong.`,
        `${escapeHtml(BRAND_NAME)} sẽ liên hệ / gửi link tải ảnh scan khi album sẵn sàng.`,
      ];

  return buildServiceNoticeEmail({
    eyebrow: 'ẢNH SCAN ĐÃ SẴN SÀNG',
    customerName: firstName,
    paragraphs,
    callout: {
      title: galleryUrl ? (isDrive ? 'Album ảnh trên Google Drive' : 'Link thư mục ảnh') : 'Sắp có link tải',
      body: linkHtml,
    },
  });
}

export function buildFilmDeliveryEmailHtml(film) {
  const ticketNumber = ticketLabel(film);
  const firstName = customerFirstName(film);
  return buildServiceNoticeEmail({
    eyebrow: 'XÁC NHẬN ĐÃ TRẢ ẢNH',
    customerName: firstName,
    paragraphs: [
      `${escapeHtml(BRAND_NAME)} đã <strong>xác nhận trả ảnh</strong> cho phiếu <strong>${escapeHtml(ticketNumber)}</strong>.`,
      'Cảm ơn bạn đã sử dụng dịch vụ. Hẹn gặp lại bạn!',
    ],
  });
}
