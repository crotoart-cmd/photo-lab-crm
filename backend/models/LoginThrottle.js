const mongoose = require('mongoose');

// Shared password-login attempt budgets; only an HMAC of the email or IP is stored.
const schema = new mongoose.Schema({
  keyHash: { type: String, required: true, unique: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 },
});

module.exports = mongoose.model('LoginThrottle', schema);
