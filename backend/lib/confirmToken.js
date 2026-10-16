const crypto = require('crypto');

function hashConfirmToken(raw) {
  return crypto.createHash('sha256').update(String(raw || ''), 'utf8').digest('hex');
}

function issueConfirmToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashConfirmToken(raw) };
}

function isPlausibleConfirmToken(raw) {
  const token = String(raw || '').trim();
  return /^[a-f0-9]{32,128}$/i.test(token);
}

module.exports = {
  hashConfirmToken,
  issueConfirmToken,
  isPlausibleConfirmToken,
};
