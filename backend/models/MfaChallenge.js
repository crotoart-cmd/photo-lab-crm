const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionVersion: { type: Number, required: true },
  mobile: { type: Boolean, default: false },
  attemptsRemaining: { type: Number, default: 5 },
  expiresAt: { type: Date, required: true, expires: 0 },
});

module.exports = mongoose.model('MfaChallenge', schema);
