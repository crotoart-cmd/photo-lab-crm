const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['owner', 'staff'],
    default: 'staff',
  },
  phone: String,
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  sessionVersion: { type: Number, default: 0 },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecretEncrypted: { type: String, select: false },
  mfaPendingSecretEncrypted: { type: String, select: false },
  mfaPendingExpiresAt: { type: Date, select: false },
  mfaLastUsedStep: { type: Number, default: -1, select: false },
  mfaRecoveryCodeHashes: { type: [String], select: false },
  mfaAttempts: { type: Number, default: 0, select: false },
  mfaAttemptExpiresAt: { type: Date, select: false },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    if (!this.isNew) this.sessionVersion = (this.sessionVersion || 0) + 1;
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
