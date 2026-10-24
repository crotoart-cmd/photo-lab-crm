const crypto = require('node:crypto');
const LoginThrottle = require('../models/LoginThrottle');
const { clientIp } = require('../middleware/rateLimit');

const WINDOW_MS = 15 * 60000;
const ACCOUNT_MAX = 10;
const IP_MAX = 30;

const keyHash = (kind, value) => crypto.createHmac('sha256', process.env.JWT_SECRET)
  .update(`hdtlabx:login-throttle:v1:${kind}:${value}`).digest('hex');

function loopbackDev(req) {
  const ip = clientIp(req);
  return process.env.NODE_ENV !== 'production' && /^(::1|(::ffff:)?127\.0\.0\.1)$/.test(ip);
}

// Reserve one attempt before the password is checked, so parallel guesses
// cannot all pass a read-then-write check. Budgets live in MongoDB and survive
// restarts and multiple workers; every window ends after 15 minutes.
async function reserve(hash, max, now) {
  await LoginThrottle.updateOne({ keyHash: hash, expiresAt: { $lte: now } },
    { $set: { attempts: 0, expiresAt: new Date(now.getTime() + WINDOW_MS) } });
  for (let tries = 0; ; tries++) {
    try {
      const row = await LoginThrottle.findOneAndUpdate({ keyHash: hash },
        { $inc: { attempts: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + WINDOW_MS) } },
        { upsert: true, new: true });
      return row.attempts <= max;
    } catch (err) {
      if (err?.code !== 11000 || tries > 0) throw err;
    }
  }
}

async function reserveLogin(req, email) {
  const now = new Date();
  const account = keyHash('account', email);
  const okAccount = await reserve(account, ACCOUNT_MAX, now);
  const okIp = loopbackDev(req) ? true : await reserve(keyHash('ip', clientIp(req)), IP_MAX, now);
  return { allowed: okAccount && okIp, account };
}

// A correct password clears only the account budget; the IP budget keeps
// counting so one valid account cannot reset guessing against others.
async function clearAccount(account) {
  await LoginThrottle.deleteOne({ keyHash: account });
}

module.exports = { WINDOW_MS, ACCOUNT_MAX, IP_MAX, reserveLogin, clearAccount };
