export function parseDeliveryLink(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 2048) return null;
  try {
    const url = new URL(text, 'https://hdtlabx.invalid');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const match = url.pathname.match(/^\/delivery\/([a-f0-9]{32,128})\/?$/i);
    return match ? `/delivery/${match[1]}` : null;
  } catch {
    return null;
  }
}

export function safeDeliveryFileUrl(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    const url = new URL(text, 'https://hdtlabx.invalid');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return text.startsWith('/') && !text.startsWith('//') ? text : url.href;
  } catch {
    return null;
  }
}

export function isDeliveryImage(file) {
  return /\.(jpe?g|png|gif|webp|avif)$/i.test(file?.name || file?.filename || '');
}
