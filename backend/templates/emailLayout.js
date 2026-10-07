const { BRAND_NAME, BRAND_TAGLINE } = require('../config/brand');
const { getLogoImgSrc } = require('../services/emailBranding');

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatVND = (num) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(num) || 0);

/** Hộp 2 cột thông tin đơn / khách */
const buildMetaBoxHtml = (leftHtml, rightHtml) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f8f9fa;border-radius:8px;">
    <tr>
      <td style="padding:15px;vertical-align:top;font-size:13px;color:#666;line-height:1.6;width:50%;">${leftHtml}</td>
      <td style="padding:15px;text-align:right;vertical-align:top;font-size:13px;color:#666;line-height:1.6;width:50%;">${rightHtml}</td>
    </tr>
  </table>`;

const buildCalloutHtml = (title, bodyHtml) => `
  <div style="background:#fafafa;border-left:3px solid #111;padding:15px;border-radius:4px;">
    <div style="font-size:12px;font-weight:700;color:#111;text-transform:uppercase;margin-bottom:6px;">${escapeHtml(title)}</div>
    <div style="margin:0;font-size:12px;color:#666;line-height:1.55;">${bodyHtml}</div>
  </div>`;

/** Bảng sản phẩm / dịch vụ (cấu trúc tham khảo order email) */
const buildLineItemsTableHtml = (items, { nameCol = 'Dịch vụ / Sản phẩm' } = {}) => {
  const rows = (items || [])
    .map((item) => {
      const qty = item.quantity != null ? item.quantity : 1;
      const price = item.price != null ? formatVND(item.price * qty) : item.priceLabel || '—';
      const serial =
        item.serial && item.serial !== '-'
          ? `<div style="font-size:12px;color:#888;margin-top:2px;font-family:monospace;">Sê-ri: ${escapeHtml(item.serial)}</div>`
          : '';
      return `
        <tr>
          <td style="padding:15px 0;border-bottom:1px solid #eee;">
            <div style="font-size:14px;font-weight:600;color:#111;">${escapeHtml(item.name)}</div>
            ${serial}
            ${item.subtitle ? `<div style="font-size:12px;color:#888;margin-top:4px;">${escapeHtml(item.subtitle)}</div>` : ''}
          </td>
          <td style="padding:15px 0;border-bottom:1px solid #eee;text-align:center;font-size:14px;color:#111;width:48px;">${qty}</td>
          <td style="padding:15px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px;font-weight:600;color:#111;width:110px;">${price}</td>
        </tr>`;
    })
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid #111;">
          <th style="padding:10px 0;text-align:left;font-size:12px;color:#111;text-transform:uppercase;font-weight:700;">${escapeHtml(nameCol)}</th>
          <th style="padding:10px 0;text-align:center;font-size:12px;color:#111;text-transform:uppercase;font-weight:700;width:48px;">SL</th>
          <th style="padding:10px 0;text-align:right;font-size:12px;color:#111;text-transform:uppercase;font-weight:700;width:110px;">Giá</th>
        </tr>
      </thead>
      <tbody>${rows || ''}</tbody>
    </table>`;
};

const buildTotalsHtml = ({ subtotal, shippingLabel = 'Miễn phí', extraRows = [] }) => {
  const extras = extraRows
    .map(
      (r) => `
      <tr>
        <td style="font-size:14px;color:#555;padding-top:6px;">${escapeHtml(r.label)}</td>
        <td style="text-align:right;font-size:14px;color:#111;padding-top:6px;">${escapeHtml(r.value)}</td>
      </tr>`
    )
    .join('');
  return `
    <table width="100%" style="border-collapse:collapse;">
      ${subtotal != null ? `<tr><td style="font-size:14px;color:#555;">Tạm tính:</td><td style="text-align:right;font-size:14px;color:#111;">${formatVND(subtotal)}</td></tr>` : ''}
      ${extras}
      <tr>
        <td style="padding-top:10px;font-size:14px;color:#555;">Phí vận chuyển:</td>
        <td style="padding-top:10px;text-align:right;font-size:14px;color:#111;">${escapeHtml(shippingLabel)}</td>
      </tr>
      <tr style="border-top:1px dashed #ddd;">
        <td style="padding-top:15px;font-size:15px;font-weight:700;color:#111;">Tổng:</td>
        <td style="padding-top:15px;text-align:right;font-size:18px;font-weight:700;color:#111;">${formatVND(subtotal)}</td>
      </tr>
    </table>`;
};

/**
 * Khung email chuẩn HDTLabx — logo trên nền tối, thẻ trắng, nội dung động.
 */
function buildEmailLayout({
  eyebrow,
  greeting = 'Xin chào,',
  introHtml,
  metaLeftHtml = '',
  metaRightHtml = '',
  bodyHtml = '',
  calloutHtml = '',
  footerExtraHtml = '',
}) {
  const metaSection =
    metaLeftHtml || metaRightHtml
      ? `<tr><td style="padding:0 30px 20px 30px;">${buildMetaBoxHtml(metaLeftHtml, metaRightHtml)}</td></tr>`
      : '';

  const calloutSection = calloutHtml
    ? `<tr><td style="padding:0 30px 30px 30px;">${calloutHtml}</td></tr>`
    : '';

  const logoSrc = getLogoImgSrc() || '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(BRAND_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:580px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.04);border-collapse:collapse;">
          <tr>
            <td style="background:#ffffff;padding:32px 24px;text-align:center;border-bottom:1px solid #eee;">
              <img src="${logoSrc}" alt="${escapeHtml(BRAND_NAME)}" width="240" style="display:block;margin:0 auto;max-width:100%;height:auto;border:0;"/>
              <div style="color:#111;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-top:14px;font-weight:600;">${escapeHtml(eyebrow)}</div>
              <div style="color:#8e8e93;font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-top:8px;">${escapeHtml(BRAND_TAGLINE)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 30px 12px 30px;">
              <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111;">${escapeHtml(greeting)}</h2>
              <div style="margin:0;font-size:14px;color:#555;line-height:1.65;">${introHtml}</div>
            </td>
          </tr>
          ${metaSection}
          ${
            bodyHtml
              ? `<tr><td style="padding:0 30px 20px 30px;">${bodyHtml}</td></tr>`
              : ''
          }
          ${calloutSection}
          <tr>
            <td style="background:#f8f9fa;padding:24px 30px;text-align:center;border-top:1px solid #eee;">
              ${footerExtraHtml || `<p style="margin:0;font-size:12px;color:#888;">Cảm ơn bạn đã tin tưởng ${escapeHtml(BRAND_NAME)}.</p>`}
              <p style="margin:14px 0 0;font-size:11px;color:#bbb;line-height:1.45;">
                Email tự động từ hệ thống CRM ${escapeHtml(BRAND_NAME)}.<br/>Vui lòng lưu email để đối chiếu.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Thông báo dịch vụ ngắn (tráng xong / đã trả ảnh) */
function buildServiceNoticeEmail({ eyebrow, customerName, paragraphs, callout }) {
  const intro = paragraphs.map((p) => `<p style="margin:0 0 12px;">${p}</p>`).join('');
  return buildEmailLayout({
    eyebrow,
    greeting: `Xin chào ${escapeHtml(customerName)},`,
    introHtml: intro,
    calloutHtml: callout ? buildCalloutHtml(callout.title, callout.body) : '',
  });
}

module.exports = {
  escapeHtml,
  formatVND,
  buildEmailLayout,
  buildMetaBoxHtml,
  buildCalloutHtml,
  buildLineItemsTableHtml,
  buildTotalsHtml,
  buildServiceNoticeEmail,
};
