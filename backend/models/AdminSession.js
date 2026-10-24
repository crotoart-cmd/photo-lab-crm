const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  sessionIdHash: { type: String, required: true, unique: true, select: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionVersion: { type: Number, required: true },
  browser: { type: String, required: true },
  platform: { type: String, required: true },
  createdAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  revokedAt: { type: Date, default: null },
});

module.exports = mongoose.model('AdminSession', schema);
