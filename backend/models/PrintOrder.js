const mongoose = require('mongoose');

const printOrderSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'quoted', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customer_name: String,
    customer_phone: String,
    customer_email: String,
    method: { type: String, enum: ['optical', 'inkjet'], required: true },
    source: { type: String, enum: ['negative', 'lab_scan', 'files'], required: true },
    size: {
      type: String,
      enum: ['10x15', '13x18', '20x30', '30x40', '40x60', 'max', 'custom'],
      required: true,
    },
    customSize: String,
    paper: { type: String, enum: ['ilford', 'fuji', 'glossy', 'matte'], required: true },
    quantity: { type: Number, required: true, min: 1, max: 40, default: 1 },
    fileHandoff: { type: String, enum: ['link', 'usb', 'later', 'none'], default: 'none' },
    fileLink: String,
    delivery: { type: String, enum: ['pickup', 'ship'], default: 'pickup' },
    address: String,
    note: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Print_Order', printOrderSchema);
