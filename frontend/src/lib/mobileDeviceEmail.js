import { registerPlugin } from '@capacitor/core';
import { brandSubject } from '../utils/emailLayout';
import { buildRetailInvoiceHtml, receiptLinesFromCheckout } from '../utils/retailInvoiceEmail';
import { buildFilmReceiptEmailHtml } from '../utils/filmReceiptEmail';
import {
  buildFilmCompletionEmailHtml,
  buildFilmDeliveryEmailHtml,
} from '../utils/filmServiceNoticeEmail';
import {
  buildRepairIntakeEmailHtml,
  buildRepairQuoteEmailHtml,
  buildRepairReadyEmailHtml,
} from '../utils/repairServiceEmail';
import { isValidCheckoutEmail, normalizeCheckoutEmail } from '../utils/checkoutBuyer';

let smtpPlugin = null;

function getCapacitor() {
  return typeof window !== 'undefined' ? window.Capacitor : null;
}

export function isNativeIos() {
  const cap = getCapacitor();
  return Boolean(cap?.isNativePlatform?.() && cap.getPlatform?.() === 'ios');
}

export function isNativeAndroid() {
  const cap = getCapacitor();
  return Boolean(cap?.isNativePlatform?.() && cap.getPlatform?.() === 'android');
}

/** iOS Keychain hoặc Android EncryptedSharedPreferences — gửi SMTP từ máy. */
export function supportsDeviceSmtp() {
  return isNativeIos() || isNativeAndroid();
}

function vaultLabel() {
  return isNativeAndroid() ? 'bộ nhớ mã hóa máy' : 'Keychain';
}

/** Plugin native qua registerPlugin — phản hồi ngay, không chờ vô hạn. */
function getDeviceSmtpPlugin() {
  if (!supportsDeviceSmtp()) return null;
  if (!smtpPlugin) {
    smtpPlugin = registerPlugin('DeviceSmtp');
  }
  return smtpPlugin;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} quá ${Math.round(ms / 1000)} giây — thử lại hoặc cài lại app`));
      }, ms);
    }),
  ]);
}

export function capPluginErrorMessage(err, fallback = 'Lỗi plugin') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return (
    err.message ||
    err.errorMessage ||
    err.error?.message ||
    (typeof err.error === 'string' ? err.error : null) ||
    fallback
  );
}

export async function isDeviceSmtpConfigured() {
  if (!supportsDeviceSmtp()) return false;
  try {
    const smtp = getDeviceSmtpPlugin();
    if (!smtp) return false;
    const { configured } = await withTimeout(smtp.isConfigured(), 5000, `Đọc ${vaultLabel()}`);
    return Boolean(configured);
  } catch {
    return false;
  }
}

export async function getDeviceSmtpStatus() {
  if (!supportsDeviceSmtp()) return { configured: false };
  const smtp = getDeviceSmtpPlugin();
  if (!smtp) return { configured: false, pluginMissing: true };
  try {
    return await withTimeout(smtp.isConfigured(), 5000, `Đọc ${vaultLabel()}`);
  } catch (err) {
    return { configured: false, error: capPluginErrorMessage(err) };
  }
}

export async function saveDeviceSmtpCredentials(email, appPassword) {
  const smtp = getDeviceSmtpPlugin();
  if (!smtp) throw new Error('Plugin gửi email chưa sẵn sàng — cài lại app');
  return withTimeout(
    smtp.saveCredentials({ email: email.trim(), appPassword }),
    8000,
    `Lưu ${vaultLabel()}`
  );
}

export async function clearDeviceSmtpCredentials() {
  const smtp = getDeviceSmtpPlugin();
  if (!smtp) throw new Error('Plugin gửi email chưa sẵn sàng');
  return withTimeout(smtp.clearCredentials(), 5000, `Xóa ${vaultLabel()}`);
}

export async function verifyDeviceSmtp() {
  const smtp = getDeviceSmtpPlugin();
  if (!smtp) throw new Error('Plugin gửi email chưa sẵn sàng — cài lại app');
  return withTimeout(smtp.verify(), 35000, 'Gửi email thử');
}

const BOOTSTRAP_FLAG = 'nuocleo_device_smtp_bootstrapped';

export async function bootstrapDeviceSmtpFromBuild() {
  if (!supportsDeviceSmtp()) return { ok: false, reason: 'not-native' };

  const smtp = getDeviceSmtpPlugin();
  if (!smtp) return { ok: false, reason: 'plugin-missing' };

  const email = (import.meta.env.VITE_DEVICE_SMTP_EMAIL || '').trim();
  const appPassword = (import.meta.env.VITE_DEVICE_SMTP_PASSWORD || '').replace(/\s/g, '');
  if (!email || appPassword.length < 16) {
    return { ok: false, reason: 'no-build-config' };
  }

  try {
    const status = await withTimeout(smtp.isConfigured(), 5000, `Đọc ${vaultLabel()}`);
    if (status.configured && status.email?.toLowerCase() === email.toLowerCase()) {
      localStorage.setItem(BOOTSTRAP_FLAG, '1');
      return { ok: true, already: true, email: status.email };
    }

    const bootFlag = localStorage.getItem(BOOTSTRAP_FLAG);
    if (bootFlag === '1' && status.configured) {
      return { ok: true, already: true, email: status.email };
    }

    await withTimeout(
      smtp.saveCredentials({ email, appPassword }),
      8000,
      `Lưu ${vaultLabel()}`
    );
    localStorage.setItem(BOOTSTRAP_FLAG, '1');
    const after = await withTimeout(smtp.isConfigured(), 5000, `Đọc ${vaultLabel()}`);
    return { ok: Boolean(after.configured), email, configured: after.configured };
  } catch (err) {
    return { ok: false, reason: capPluginErrorMessage(err, 'bootstrap-failed') };
  }
}

function normalizeEmail(email) {
  return normalizeCheckoutEmail(email);
}

/** Gửi HTML qua DeviceSmtp — dùng chung mọi luồng khách. */
async function sendHtmlFromDevice({ to, subject, html, timeoutLabel = 'Gửi email' }) {
  if (!supportsDeviceSmtp()) {
    return { sent: false, skipped: true, reason: 'not-native' };
  }
  const buyerEmail = normalizeEmail(to);
  if (!buyerEmail) {
    return { sent: false, skipped: true, reason: 'no-email' };
  }
  if (!isValidCheckoutEmail(buyerEmail)) {
    return { sent: false, error: `Email không hợp lệ: ${buyerEmail}` };
  }

  const smtp = getDeviceSmtpPlugin();
  if (!smtp) {
    return { sent: false, skipped: true, reason: 'plugin-missing' };
  }

  let status;
  try {
    status = await withTimeout(smtp.isConfigured(), 5000, `Đọc ${vaultLabel()}`);
  } catch {
    return { sent: false, skipped: true, reason: 'not-configured' };
  }
  if (!status.configured) {
    return { sent: false, skipped: true, reason: 'not-configured' };
  }

  try {
    const result = await withTimeout(
      smtp.sendMail({
        to: buyerEmail,
        subject,
        html,
        fromName: 'HDTLabx',
      }),
      35000,
      timeoutLabel
    );
    if (result?.sent === true) {
      return { sent: true, to: buyerEmail };
    }
    return { sent: false, error: result.error || 'Gửi email thất bại' };
  } catch (err) {
    return { sent: false, error: capPluginErrorMessage(err, 'Gửi email thất bại') };
  }
}

function filmBuyerEmail(film) {
  const customer =
    film?.customerId && typeof film.customerId === 'object' ? film.customerId : null;
  return normalizeEmail(film?.intakeChecklist?.contactEmail || customer?.email || '');
}

export async function sendFilmReceiptFromDevice(film) {
  const buyerEmail = filmBuyerEmail(film);
  const customer =
    film?.customerId && typeof film.customerId === 'object' ? film.customerId : null;
  const ticketNumber = film.ticketNumber || film.filmCode || 'PH';
  return sendHtmlFromDevice({
    to: buyerEmail,
    subject: brandSubject(`Phiếu tiếp nhận film - ${ticketNumber}`),
    html: buildFilmReceiptEmailHtml(film, {
      firstName: customer?.firstName || film?.intakeChecklist?.contactName || 'Quý khách',
      lastName: customer?.lastName || '',
      phone: customer?.phone || film?.intakeChecklist?.contactPhone || '',
      email: buyerEmail,
    }),
    timeoutLabel: 'Gửi email phiếu film',
  });
}

export async function sendFilmCompletionFromDevice(film, options = {}) {
  const galleryUrl =
    options.galleryUrl ||
    film.driveWebViewLink ||
    (film.deliverySlug
      ? `${(import.meta.env.VITE_FRONTEND_URL || '').replace(/\/$/, '') || 'https://localhost'}/delivery/${film.deliverySlug}`
      : null);
  const linkKind = options.linkKind || (film.driveWebViewLink ? 'drive' : 'local');
  const ticketNumber = film.ticketNumber || film.filmCode || 'PH';
  return sendHtmlFromDevice({
    to: filmBuyerEmail(film),
    subject: brandSubject(`Ảnh scan đã sẵn sàng - ${ticketNumber}`),
    html: buildFilmCompletionEmailHtml(film, { galleryUrl, linkKind }),
    timeoutLabel: 'Gửi email ảnh sẵn sàng',
  });
}

export async function sendFilmDeliveryFromDevice(film) {
  const ticketNumber = film.ticketNumber || film.filmCode || 'PH';
  return sendHtmlFromDevice({
    to: filmBuyerEmail(film),
    subject: brandSubject(`Đã trả ảnh - ${ticketNumber}`),
    html: buildFilmDeliveryEmailHtml(film),
    timeoutLabel: 'Gửi email trả ảnh',
  });
}

function repairConfirmBase() {
  const fromEnv = (import.meta.env.VITE_FRONTEND_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')) {
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
}

export async function sendRepairIntakeFromDevice(ticket) {
  return sendHtmlFromDevice({
    to: ticket.customer_email,
    subject: brandSubject(`Tiếp nhận sửa máy - ${ticket.ticket_number}`),
    html: buildRepairIntakeEmailHtml(ticket),
    timeoutLabel: 'Gửi email sửa máy',
  });
}

export async function sendRepairQuoteFromDevice(ticket) {
  const base = repairConfirmBase();
  const confirmUrl =
    base && ticket.confirm_token
      ? `${base}/repair/confirm/${ticket.confirm_token}?action=accept`
      : '';
  const declineUrl =
    base && ticket.confirm_token
      ? `${base}/repair/confirm/${ticket.confirm_token}?action=decline`
      : '';
  return sendHtmlFromDevice({
    to: ticket.customer_email,
    subject: brandSubject(`Báo giá sửa máy - ${ticket.ticket_number}`),
    html: buildRepairQuoteEmailHtml(ticket, { confirmUrl, declineUrl }),
    timeoutLabel: 'Gửi email báo giá',
  });
}

export async function sendRepairReadyFromDevice(ticket) {
  return sendHtmlFromDevice({
    to: ticket.customer_email,
    subject: brandSubject(`Máy sẵn sàng trả - ${ticket.ticket_number}`),
    html: buildRepairReadyEmailHtml(ticket),
    timeoutLabel: 'Gửi email sẵn sàng trả',
  });
}

export async function sendSaleReceiptFromDevice({ payload, log }) {
  const buyerEmail = normalizeEmail(payload.customer_email);
  const lines = receiptLinesFromCheckout(payload.items, log);
  const hasCamera = (payload.items || []).some((i) => i.product_group === 'camera');
  const orderCode =
    log.length === 1 ? log[0].sale_code : `BATCH-${log[0]?.sale_code || Date.now()}`;
  const customerName = payload.customer_name?.trim() || 'Quý khách';

  return sendHtmlFromDevice({
    to: buyerEmail,
    subject: hasCamera
      ? brandSubject(`Phiếu bán hàng & bảo hành - ${orderCode}`)
      : brandSubject(`Phiếu bán hàng - ${orderCode}`),
    html: buildRetailInvoiceHtml({
      customerName,
      orderCode,
      lines,
      includeWarranty: hasCamera,
    }),
    timeoutLabel: 'Gửi email',
  });
}
