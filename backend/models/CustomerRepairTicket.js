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

const intakeMediaSchema = new mongoose.Schema({
  id: { type: String, required: true, immutable: true },
  storage_key: { type: String, required: true, immutable: true },
  original_name: { type: String, required: true, immutable: true },
  mime_type: { type: String, required: true, immutable: true },
  size: { type: Number, required: true, min: 1, immutable: true },
  sha256: { type: String, required: true, immutable: true },
  uploaded_at: { type: Date, required: true, immutable: true },
  source: { type: String, enum: ['customer'], required: true, immutable: true },
}, { _id: false });

const customerSubmissionSchema = new mongoose.Schema({
  submitted_at: { type: Date, required: true, immutable: true },
  model_name: { type: String, immutable: true },
  brand: { type: String, immutable: true },
  serial_number: { type: String, immutable: true },
  symptom: { type: String, immutable: true },
  condition_at_intake: { type: String, immutable: true },
}, { _id: false });

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

  intake_media: { type: [intakeMediaSchema], default: undefined, immutable: true },
  customer_submission: { type: customerSubmissionSchema, immutable: true },
  media_acknowledged_at: { type: Date, immutable: true },
  media_acknowledgment_version: { type: String, immutable: true },

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
  confirm_token_hash: { type: String, unique: true, sparse: true, index: true },
  confirm_token_expires: Date,
  confirmed_at: Date,
  confirmed_via: { type: String, enum: ['email_link', 'counter', null], default: null },
  rejected_at: Date,

  intake_email_sent_at: Date,
  quote_email_sent_at: Date,
  ready_email_sent_at: Date,

  received_at: Date,
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
  if (!this.isNew && ['intake_media', 'customer_submission', 'media_acknowledged_at', 'media_acknowledgment_version'].some((key) => this.isModified(key))) {
    return next(Object.assign(new Error('Không được thay đổi tư liệu khách đã gửi'), { status: 400 }));
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Customer_Repair_Ticket', customerRepairTicketSchema);
