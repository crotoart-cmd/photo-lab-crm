const mongoose = require('mongoose');

const filmSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  filmCode: {
    type: String,
    unique: true,
    required: true,
  },
  confirmationCode: {
    type: String,
    unique: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
  filmType: {
    type: String,
    enum: ['color', 'black_white', 'slide'],
    required: true,
  },
  receivedAt: {
    type: Date,
    default: Date.now,
  },
  processingStartedAt: Date,
  completedAt: Date,
  deliveredAt: Date,
  status: {
    type: String,
    enum: ['received', 'processing', 'completed', 'delivered', 'cancelled'],
    default: 'received',
  },
  processingNotes: String,
  emailSentAt: Date,
  emailDeliveryConfirmedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Film', filmSchema);
