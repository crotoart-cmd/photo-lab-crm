const hitsByBucket = new Map();
const MAX_KEYS = 20000;

function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function pruneBucket(key, now, windowMs) {
  const next = (hitsByBucket.get(key) || []).filter((t) => now - t < windowMs);
  if (!next.length) hitsByBucket.delete(key);
  else hitsByBucket.set(key, next);
  return next;
}

function isLoopback(req) {
  const ip = clientIp(req);
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost' ||
    ip.endsWith('127.0.0.1')
  );
}

/** Peer is the hosting proxy, not a visitor. A small cap on this address locks every customer together. */
function isSharedProxyPeer(ip) {
  const raw = String(ip || '').toLowerCase();
  const v4 = raw.startsWith('::ffff:') ? raw.slice(7) : raw;
  if (v4 === '127.0.0.1' || v4 === '::1' || v4 === 'localhost' || v4 === '0.0.0.0' || v4 === '::') return true;
  if (/^10\./.test(v4) || /^192\.168\./.test(v4) || /^169\.254\./.test(v4)) return true;
  const lan = /^172\.(\d+)\./.exec(v4);
  if (lan && Number(lan[1]) >= 16 && Number(lan[1]) <= 31) return true;
  return raw.startsWith('fc') || raw.startsWith('fd') || raw.startsWith('fe80:');
}

function tooManyRequests(req, max = 8, windowMs = 60 * 60 * 1000, bucket = 'public') {
  if (process.env.NODE_ENV !== 'production' && isLoopback(req)) return false;
  const ip = clientIp(req);
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  if (hitsByBucket.size > MAX_KEYS && !hitsByBucket.has(key)) {
    const oldest = hitsByBucket.keys().next().value;
    hitsByBucket.delete(oldest);
  }
  const next = pruneBucket(key, now, windowMs);
  if (next.length >= max) return true;
  next.push(now);
  hitsByBucket.set(key, next);
  return false;
}

function rateLimit({ max, windowMs, bucket, message } = {}) {
  const limit = max || 60;
  const window = windowMs || 60 * 1000;
  const name = bucket || 'default';
  const text = message || 'Quá nhiều yêu cầu. Thử lại sau.';
  return (req, res, next) => {
    if (tooManyRequests(req, limit, window, name)) {
      res.setHeader('Retry-After', String(Math.ceil(window / 1000)));
      return res.status(429).json({ message: text });
    }
    next();
  };
}

function resetRateLimitForTests() {
  hitsByBucket.clear();
}

module.exports = {
  clientIp,
  isSharedProxyPeer,
  tooManyRequests,
  rateLimit,
  resetRateLimitForTests,
};
