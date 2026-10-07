/** Email/tên khách lúc checkout — ưu tiên ô nhập tay, không ghi đè bởi hồ sơ cũ. */
export function resolveCheckoutBuyer({ selectedBuyer, buyerName, buyerEmail, fullName }) {
  const typedName = String(buyerName || '').trim();
  const typedEmail = String(buyerEmail || '').trim();
  const profileName = selectedBuyer && fullName ? fullName(selectedBuyer).trim() : '';
  const profileEmail = String(selectedBuyer?.email || '').trim();

  return {
    customerId: selectedBuyer?._id,
    customer_name: typedName || profileName || undefined,
    customer_email: typedEmail || profileEmail || undefined,
  };
}

export function normalizeCheckoutEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidCheckoutEmail(email) {
  const e = normalizeCheckoutEmail(email);
  return Boolean(e && EMAIL_RE.test(e));
}

/** Đủ thông tin khách để thanh toán — cần tên + email hợp lệ */
export function hasCheckoutBuyerInfo({ selectedBuyer, buyerName, buyerEmail, fullName }) {
  const { customer_name, customer_email } = resolveCheckoutBuyer({
    selectedBuyer,
    buyerName,
    buyerEmail,
    fullName,
  });
  return Boolean(String(customer_name || '').trim()) && isValidCheckoutEmail(customer_email);
}
