const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  event: { type: String, required: true, enum: ['login', 'mfa_login', 'mfa_setup', 'mfa_enable', 'mfa_disable', 'mfa_recovery', 'profile', 'logout', 'session_revoke'] },
  outcome: { type: String, required: true, enum: ['success', 'failure', 'challenge'] },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  ipHash: { type: String, select: false },
  deviceHash: { type: String, select: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, expires: 0 },
});

module.exports = mongoose.model('SecurityEvent', schema);
