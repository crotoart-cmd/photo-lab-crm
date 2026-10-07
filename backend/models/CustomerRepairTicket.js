const mongoose = require('mongoose');
const { REPAIR_STATUSES } = require('../constants/customerRepair');

const statusHistorySchema = new mongoose.Schema(
  {
    status: String,
    note: String,
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const quoteLineSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    amount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const workLogSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    vendor: String,
    parts_cost: { type: Number, default: 0, min: 0 },
    labor_cost: { type: Number, default: 0, min: 0 },
    total_cost: { type: Number, default: 0, min: 0 },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const customerRepairTicketSchema = new mongoose.Schema({
  ticket_number: { type: String, required: true, unique: true, uppercase: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  customer_name: { type: String, required: true, trim: true },
  customer_email: { type: String, required: true, trim: true, lowercase: true },
  customer_phone: { type: String, trim: true },

  model_name: { type: String, required: true, trim: true },
  brand: { type: String, trim: true },
  serial_number: { type: String, trim: true, uppercase: true },

  symptom: { type: String, required: true, trim: true },
  intake_note: { type: String, trim: true },
  condition_at_intake: { type: String, trim: true },

  status: {
    type: String,
    enum: REPAIR_STATUSES,
    default: 'tiep_nhan',
    index: true,
  },

  quote_amount: { type: Number, default: 0, min: 0 },
  quote_note: { type: String, trim: true },
  quote_lines: [quoteLineSchema],
  deposit_amount: { type: Number, default: 0, min: 0 },
  final_amount: { type: Number, default: 0, min: 0 },

  internal_parts_cost: { type: Number, default: 0, min: 0 },
  internal_labor_cost: { type: Number, default: 0, min: 0 },

  confirm_token: { type: String, unique: true, sparse: true, index: true },
  confirm_token_expires: Date,
  confirmed_at: Date,
  confirmed_via: { type: String, enum: ['email_link', 'counter', null], default: null },
  rejected_at: Date,

  intake_email_sent_at: Date,
  quote_email_sent_at: Date,
  ready_email_sent_at: Date,

  received_at: { type: Date, default: Date.now },
  quote_sent_at: Date,
  repair_started_at: Date,
  completed_at: Date,
  returned_at: Date,

  work_logs: [workLogSchema],
  statusHistory: [statusHistorySchema],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

customerRepairTicketSchema.pre('save', function touchUpdated(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Customer_Repair_Ticket', customerRepairTicketSchema);
