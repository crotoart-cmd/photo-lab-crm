const mongoose = require('mongoose');

const scanOrderSchema = new mongoose.Schema(
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
    method: { type: String, enum: ['hiend', 'batch'], required: true },
    source: { type: String, enum: ['negative', 'lab_roll'], required: true },
    format: { type: String, enum: ['35mm', '120', 'other'], required: true },
    scanSize: { type: String, enum: ['s', 'm', 'l', 'hiend'], required: true },
    output: { type: String, enum: ['jpeg', 'tiff', 'both'], required: true },
    quantity: { type: Number, required: true, min: 1, max: 20, default: 1 },
    ticketRef: String,
    delivery: { type: String, enum: ['pickup', 'ship'], default: 'pickup' },
    address: String,
    note: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Scan_Order', scanOrderSchema);
