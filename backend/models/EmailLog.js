const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  filmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Film',
    required: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  recipientEmail: String,
  emailType: {
    type: String,
    enum: ['confirmation', 'completion', 'delivery'],
  },
  subject: String,
  body: String,
  sentAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['sent', 'failed'],
    default: 'sent',
  },
  error: String,
});

module.exports = mongoose.model('EmailLog', emailLogSchema);
