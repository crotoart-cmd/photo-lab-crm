function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Chuẩn hóa SĐT VN — 0xxxxxxxxx */
function normalizePhoneVN(phone) {
  let d = digitsOnly(phone);
  if (!d) return '';
  if (d.startsWith('84') && d.length >= 11) d = `0${d.slice(2)}`;
  if (d.length === 9 && !d.startsWith('0')) d = `0${d}`;
  return d;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeNamePart(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function removeDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function fullName(customer) {
  return `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();
}

/** Trường khách dùng khi gửi email — loại bỏ ghi chú nội bộ */
function customerForEmail(customer) {
  if (!customer || typeof customer !== 'object') return null;
  return {
    _id: customer._id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
  };
}

function searchKey(customer) {
  const phone = digitsOnly(customer?.phone);
  return [
    removeDiacritics(fullName(customer)),
    removeDiacritics(customer?.email || ''),
    removeDiacritics(customer?.customerCode || ''),
    phone,
    phone.slice(-4),
  ]
    .filter(Boolean)
    .join(' ');
}

function validateCustomerInput(body) {
  const errors = [];
  const firstName = normalizeNamePart(body.firstName);
  const lastName = normalizeNamePart(body.lastName);
  const email = normalizeEmail(body.email);
  const phone = normalizePhoneVN(body.phone);

  if (!firstName) errors.push('Họ không được trống');
  if (!lastName) errors.push('Tên không được trống');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email không hợp lệ');
  }
  if (!phone || phone.length < 9 || phone.length > 11) {
    errors.push('Số điện thoại không hợp lệ');
  }

  return {
    errors,
    normalized: {
      firstName,
      lastName,
      email,
      phone,
      address: String(body.address || '').trim(),
      city: String(body.city || '').trim(),
      postalCode: String(body.postalCode || '').trim(),
      notes: String(body.notes || '').trim(),
      status: body.status === 'inactive' ? 'inactive' : 'active',
    },
  };
}

module.exports = {
  digitsOnly,
  normalizePhoneVN,
  normalizeEmail,
  normalizeNamePart,
  removeDiacritics,
  fullName,
  customerForEmail,
  searchKey,
  validateCustomerInput,
};
