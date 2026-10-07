/**
 * Parse QR payload từ app khách hàng HDTLabx.
 * Hỗ trợ: URL scheme, JSON, mã KH-*, MongoDB id, SĐT, email thuần.
 */
export function parseCustomerQrPayload(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      return {
        id: data.customerId || data.id || data._id,
        code: data.customerCode || data.code,
        phone: data.phone,
        email: data.email,
      };
    } catch {
      return { raw: trimmed };
    }
  }

  const schemeMatch = trimmed.match(/^labstart:\/\/customer\/([^/?#]+)/i);
  if (schemeMatch) {
    const token = decodeURIComponent(schemeMatch[1]);
    if (/^[a-f\d]{24}$/i.test(token)) return { id: token };
    return { code: token.toUpperCase() };
  }

  try {
    const asUrl = trimmed.includes('://') ? trimmed : `https://local/?${trimmed}`;
    const url = new URL(asUrl.replace(/^labstart:\/\//i, 'https://labstart.app/'));
    const id = url.searchParams.get('id') || url.searchParams.get('customerId');
    const code = url.searchParams.get('code') || url.searchParams.get('customerCode');
    const phone = url.searchParams.get('phone');
    const email = url.searchParams.get('email');
    if (id || code || phone || email) {
      return { id, code, phone, email };
    }
    const pathToken = url.pathname.split('/').filter(Boolean).pop();
    if (pathToken && pathToken !== 'customer') {
      if (/^[a-f\d]{24}$/i.test(pathToken)) return { id: pathToken };
      return { code: pathToken.toUpperCase() };
    }
  } catch {
    // not a URL
  }

  if (/^KH-[A-Z0-9-]+$/i.test(trimmed)) return { code: trimmed.toUpperCase() };
  if (/^[a-f\d]{24}$/i.test(trimmed)) return { id: trimmed };
  if (trimmed.includes('@')) return { email: trimmed.toLowerCase() };
  if (/^[\d\s+\-().]{8,}$/.test(trimmed)) return { phone: trimmed.replace(/\D/g, '') };

  return { raw: trimmed };
}
