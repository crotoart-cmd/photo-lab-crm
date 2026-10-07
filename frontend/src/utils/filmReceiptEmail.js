import { BRAND_NAME } from '../config/brand';
import { buildEmailLayout, buildCalloutHtml, escapeHtml } from './emailLayout';
import {
  FILM_FORMATS,
  FILM_TYPE_DETAILS,
  PROCESSING_PROCESSES,
  LEADER_STATUS,
  CANISTER_CONDITIONS,
  FILM_STUCK,
  WET_MOLD,
  ISO_HANDLING,
  CUT_FILM,
  SCAN_FORMATS,
  SCAN_RESOLUTIONS,
  COLOR_TONES,
  ORIGINAL_RETURN,
  PAYMENT_STATUS,
  labelOf,
} from './intakeOptions';

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  } catch {
    return String(d);
  }
};

const fmtMoney = (n) => {
  if (n == null || n === '') return null;
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  return `${num.toLocaleString('vi-VN')} đ`;
};

const customerName = (customer) => {
  if (!customer) return '—';
  if (typeof customer === 'object') {
    return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || '—';
  }
  return '—';
};

const ticketCode = (film) => film.ticketNumber || film.filmCode || '—';

const detailRow = (label, value) => {
  const v = value != null && value !== '' && value !== '—' ? escapeHtml(value) : '';
  if (!v) return '';
  return `<tr>
    <td style="padding:8px 0;color:#64748b;font-size:13px;width:40%;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;color:#111;">${v}</td>
  </tr>`;
};

const checklistBlock = (title, rowsHtml) => {
  if (!rowsHtml.trim()) return '';
  return `
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid #eee;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;">${escapeHtml(title)}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rowsHtml}</table>
    </div>`;
};

const row = (label, value) => {
  const v = value != null && value !== '' && value !== '—' ? escapeHtml(value) : '';
  if (!v) return '';
  return `<tr>
    <td style="padding:5px 0;color:#64748b;font-size:12px;">${escapeHtml(label)}</td>
    <td style="padding:5px 0;font-size:12px;font-weight:600;text-align:right;color:#111;">${v}</td>
  </tr>`;
};

function buildChecklistBlocks(checklist) {
  if (!checklist) return '<p style="font-size:13px;color:#94a3b8;">Chưa có checklist tiếp nhận</p>';
  const c = checklist;

  return (
    checklistBlock(
      '1. Loại phim',
      [
        row('Khổ', labelOf(FILM_FORMATS, c.filmFormat)),
        c.filmFormatNote ? row('Ghi chú khổ', c.filmFormatNote) : '',
        row('Loại', labelOf(FILM_TYPE_DETAILS, c.filmTypeDetail)),
        row('Quy trình', labelOf(PROCESSING_PROCESSES, c.processingProcess)),
        c.processingProcessNote ? row('Ghi chú QT', c.processingProcessNote) : '',
      ].join('')
    ) +
    checklistBlock(
      '2. Tình trạng vật lý',
      [
        row('Leader', labelOf(LEADER_STATUS, c.leaderStatus)),
        row('Vỏ', labelOf(CANISTER_CONDITIONS, c.canisterCondition)),
        c.canisterConditionNote ? row('Chi tiết vỏ', c.canisterConditionNote) : '',
        row('Kẹt/đứt', labelOf(FILM_STUCK, c.filmStuckBroken)),
        c.filmStuckBrokenNote ? row('Chi tiết kẹt', c.filmStuckBrokenNote) : '',
        row('Ẩm/mốc', labelOf(WET_MOLD, c.wetMold)),
        c.wetMoldNote ? row('Chi tiết mốc', c.wetMoldNote) : '',
      ].join('')
    ) +
    checklistBlock(
      '3. Xử lý kỹ thuật',
      [
        row('ISO', labelOf(ISO_HANDLING, c.isoHandling)),
        c.isoValue ? row('ISO gốc', String(c.isoValue)) : '',
        c.pushPullStops ? row('Stop', String(c.pushPullStops)) : '',
        row('Cắt phim', labelOf(CUT_FILM, c.cutFilm)),
        row('File scan', labelOf(SCAN_FORMATS, c.scanFileFormat)),
        row('Độ phân giải', labelOf(SCAN_RESOLUTIONS, c.scanResolution)),
        row('Tông màu', labelOf(COLOR_TONES, c.colorTone)),
        c.technicalNotes ? row('Ghi chú KT', c.technicalNotes) : '',
      ].join('')
    ) +
    checklistBlock(
      '4. Giao nhận & TT',
      [
        row('Liên lạc', c.contactVerified ? 'Đã xác nhận ✓' : 'Chưa xác nhận'),
        row('Họ tên', c.contactName),
        row('SĐT', c.contactPhone),
        row('Email', c.contactEmail),
        row('Hẹn trả', c.promisedReturnAt ? fmtDate(c.promisedReturnAt) : null),
        row('Film gốc', labelOf(ORIGINAL_RETURN, c.originalFilmReturn)),
        c.shippingAddress ? row('Địa chỉ ship', c.shippingAddress) : '',
        row('Thanh toán', labelOf(PAYMENT_STATUS, c.paymentStatus)),
        fmtMoney(c.paymentAmount) ? row('Số tiền', fmtMoney(c.paymentAmount)) : '',
        c.inspectedBy ? row('NV kiểm tra', c.inspectedBy) : '',
        c.paymentNote ? row('Ghi chú', c.paymentNote) : '',
      ].join('')
    )
  );
}

/** HTML phiếu tiếp nhận film — cùng layout backend / email Mac. */
export function buildFilmReceiptEmailHtml(film, customer) {
  const t = ticketCode(film);
  const received = fmtDate(film.receivedAt || film.createdAt);
  const name = customerName(customer);
  const phone = customer?.phone || film?.intakeChecklist?.contactPhone || '—';
  const emailAddr = customer?.email || film?.intakeChecklist?.contactEmail || '—';
  const qty = film.quantity || 1;
  const c = film.intakeChecklist;
  const summaryLine = c
    ? `${labelOf(FILM_FORMATS, c.filmFormat)} · ${labelOf(FILM_TYPE_DETAILS, c.filmTypeDetail)} · ${labelOf(PROCESSING_PROCESSES, c.processingProcess)}`
    : '';

  const summaryTable = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
      ${detailRow('Mã phiếu', t)}
      ${detailRow('Ngày tiếp nhận', received)}
      ${detailRow('Số cuộn', `${qty} cuộn`)}
      ${summaryLine ? detailRow('Tóm tắt', summaryLine) : ''}
    </table>
    ${buildChecklistBlocks(c)}
    ${
      film.receptionNotes
        ? `<p style="margin-top:12px;font-size:13px;color:#555;"><strong>Ghi chú:</strong> ${escapeHtml(film.receptionNotes)}</p>`
        : ''
    }`;

  return buildEmailLayout({
    eyebrow: 'PHIẾU TIẾP NHẬN FILM',
    greeting: `Xin chào ${name},`,
    introHtml: `<p style="margin:0;">${escapeHtml(BRAND_NAME)} đã tiếp nhận film của bạn. Nội dung phiếu dưới đây trùng với phiếu in tại lab.</p>`,
    metaLeftHtml: `<strong style="color:#111;">MÃ PHIẾU:</strong> ${escapeHtml(t)}<br/><strong style="color:#111;">Ngày:</strong> ${escapeHtml(received)}`,
    metaRightHtml: `<strong style="color:#111;">KHÁCH HÀNG:</strong><br/>${escapeHtml(name)}<br/>${escapeHtml(phone)}<br/>${escapeHtml(emailAddr)}`,
    bodyHtml: summaryTable,
    calloutHtml: buildCalloutHtml(
      'Tiếp theo',
      'Bạn sẽ nhận thêm email khi film <strong>tráng xong</strong> và khi lab <strong>xác nhận đã trả ảnh</strong>.'
    ),
  });
}
