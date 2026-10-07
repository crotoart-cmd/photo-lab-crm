export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizePhoneVN(phone) {
  let d = digitsOnly(phone);
  if (!d) return '';
  if (d.startsWith('84') && d.length >= 11) d = `0${d.slice(2)}`;
  if (d.length === 9 && !d.startsWith('0')) d = `0${d}`;
  return d;
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeNamePart(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function removeDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function fullName(customer) {
  return `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();
}

/** Chữ cái đầu họ + tên cho avatar */
export function customerInitials(customer) {
  const parts = fullName(customer).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) || '?').toUpperCase();
}

/** Tách "Họ và tên" → firstName (họ) + lastName (tên) */
export function splitFullName(value) {
  const normalized = normalizeNamePart(value);
  if (!normalized) return { firstName: '', lastName: '' };
  const space = normalized.indexOf(' ');
  if (space === -1) {
    return { firstName: normalized, lastName: '' };
  }
  return {
    firstName: normalized.slice(0, space),
    lastName: normalized.slice(space + 1).trim(),
  };
}

export function validateCustomerForm(form) {
  const errors = [];
  let { firstName, lastName } =
    form.fullName != null
      ? splitFullName(form.fullName)
      : {
          firstName: normalizeNamePart(form.firstName),
          lastName: normalizeNamePart(form.lastName),
        };

  if (firstName && !lastName) lastName = firstName;
  if (!firstName && lastName) firstName = lastName;

  const email = normalizeEmail(form.email);
  const phone = normalizePhoneVN(form.phone);

  if (!firstName && !lastName) {
    errors.push('Họ và tên không được trống');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email không hợp lệ');
  if (!phone || phone.length < 9) errors.push('Số điện thoại không hợp lệ');

  return {
    errors,
    normalized: {
      firstName,
      lastName,
      email,
      phone,
      address: String(form.address || '').trim(),
      city: String(form.city || '').trim(),
      postalCode: String(form.postalCode || '').trim(),
      notes: String(form.notes || '').trim(),
    },
  };
}

export function buildSearchKey(customer) {
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
