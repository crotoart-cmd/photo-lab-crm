const mongoose = require('mongoose');

const shopOrderItemSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ['film', 'battery', 'camera', 'merch'], required: true },
    ref: { type: String, required: true },
    sku: String,
    serial: String,
    title: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const shopOrderSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },
    items: { type: [shopOrderItemSchema], default: [] },
    total: { type: Number, default: 0, min: 0 },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customer_name: String,
    customer_phone: String,
    customer_email: String,
    delivery: { type: String, enum: ['pickup', 'ship'], default: 'pickup' },
    address: String,
    note: String,
    holdUntil: { type: Date, index: true },
    paidAt: Date,
    cancelledAt: Date,
    cancelReason: String,
    saleCodes: [String],
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Shop_Order', shopOrderSchema);
