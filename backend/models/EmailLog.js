const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  filmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Film',
  },
  repairTicketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer_Repair_Ticket',
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  recipientEmail: String,
  emailType: {
    type: String,
    enum: [
      'confirmation',
      'completion',
      'delivery',
      'sale_receipt',
      'sale_warranty',
      'repair_intake',
      'repair_quote',
      'repair_ready',
    ],
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
