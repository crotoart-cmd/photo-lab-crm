const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TTL_MS = 5 * 60 * 1000;
const pending = new Map();

function hmac(value) {
  return crypto.createHmac('sha256', String(process.env.JWT_SECRET || 'dev-captcha')).update(value).digest('base64url');
}

function prune(now) {
  for (const [id, row] of pending) {
    if (row.exp <= now) pending.delete(id);
  }
}

function svg(answer) {
  const glyphs = [...answer].map((char, index) => {
    const x = 16 + index * 28;
    const y = 34 + (index % 3) * 3;
    const tilt = index % 2 === 0 ? -7 : 8;
    return `<text x="${x}" y="${y}" transform="rotate(${tilt} ${x} ${y})" font-size="26" font-family="Georgia,serif" fill="#111">${char}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="52" viewBox="0 0 164 52" role="img"><rect width="164" height="52" fill="#f4f4f6"/><path d="M6 28 H158" stroke="#c8c8cc" stroke-width="1"/>${glyphs}</svg>`;
}

function issueCaptcha() {
  const now = Date.now();
  if (pending.size > 2000) prune(now);
  const answer = Array.from(crypto.randomBytes(5), (byte) => ALPHABET[byte % ALPHABET.length]).join('');
  const id = crypto.randomBytes(16).toString('hex');
  const exp = now + TTL_MS;
  pending.set(id, { hash: crypto.createHash('sha256').update(answer).digest(), exp });
  const token = Buffer.from(`${id}.${exp}.${hmac(`${id}.${exp}`)}`).toString('base64url');
  return { token, image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(answer))}`, answer };
}

function verifyCaptcha(token, answer) {
  const now = Date.now();
  let id = '';
  let exp = '';
  let sig = '';
  try {
    const decoded = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    [id, exp, sig] = decoded.split('.');
  } catch {
    return false;
  }
  const expected = hmac(`${id}.${exp}`);
  const given = Buffer.from(String(sig || ''));
  const actual = Buffer.from(expected);
  if (given.length !== actual.length || !crypto.timingSafeEqual(given, actual)) return false;
  const row = pending.get(id);
  pending.delete(id);
  if (!row || Number(exp) !== row.exp || row.exp <= now) return false;
  const hash = crypto.createHash('sha256').update(String(answer || '').trim().toUpperCase()).digest();
  return hash.length === row.hash.length && crypto.timingSafeEqual(hash, row.hash);
}

function assertPublicCaptcha(body) {
  if (verifyCaptcha(body?.captchaToken, body?.captchaAnswer)) return;
  const error = new Error('Mã xác nhận không đúng');
  error.status = 400;
  throw error;
}

function resetCaptchaForTests() {
  pending.clear();
}

module.exports = {
  issueCaptcha,
  verifyCaptcha,
  assertPublicCaptcha,
  resetCaptchaForTests,
};
