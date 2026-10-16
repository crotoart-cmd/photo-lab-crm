function publicError(res, err, fallback = 'Không xử lý được yêu cầu') {
  const status = Number(err?.status);
  const code = status >= 400 && status < 500 ? status : 500;
  const message =
    code === 500
      ? fallback
      : String(err?.publicMessage || err?.message || fallback).slice(0, 300);
  return res.status(code).json({ message });
}

function maskEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at < 1) return '[redacted]';
  return `${s.slice(0, 1)}***@***`;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

module.exports = {
  publicError,
  maskEmail,
  isValidEmail,
};
