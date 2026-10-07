const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customerCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
  },
  address: String,
  city: String,
  postalCode: String,
  notes: {
    type: String,
    comment: 'Ghi chú nội bộ — không đưa vào email gửi khách',
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

customerSchema.pre('save', async function assignCode(next) {
  if (this.customerCode) return next();
  try {
    const count = await mongoose.model('Customer').countDocuments();
    this.customerCode = `KH-${String(count + 1).padStart(6, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Customer', customerSchema);
