const mongoose = require('mongoose');

const filmSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  ticketNumber: {
    type: String,
    unique: true,
    sparse: true,
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
  receptionNotes: String,
  intakeChecklist: {
    filmFormat: { type: String, enum: ['35mm', '120', '110', 'other'] },
    filmFormatNote: String,
    filmTypeDetail: {
      type: String,
      enum: ['color_negative', 'black_white', 'slide_e6'],
    },
    processingProcess: {
      type: String,
      enum: ['c41', 'ecn2', 'bw_standard', 'bw_custom', 'e6', 'other'],
    },
    processingProcessNote: String,
    leaderStatus: {
      type: String,
      enum: ['wound_in_core', 'leader_out', 'unknown'],
    },
    canisterCondition: {
      type: String,
      enum: ['ok', 'dented', 'rusty', 'broken_light_leak', 'other'],
    },
    canisterConditionNote: String,
    filmStuckBroken: {
      type: String,
      enum: ['no', 'yes_customer_reported', 'yes_found_on_inspection'],
    },
    filmStuckBrokenNote: String,
    wetMold: { type: String, enum: ['no', 'suspected', 'yes'] },
    wetMoldNote: String,
    isoHandling: { type: String, enum: ['box_speed', 'push', 'pull'] },
    isoValue: Number,
    pushPullStops: Number,
    cutFilm: { type: String, enum: ['cut_strips', 'leave_roll', 'undecided'] },
    scanFileFormat: { type: String, enum: ['jpeg', 'tiff', 'both'] },
    scanResolution: { type: String, enum: ['s', 'm', 'l', 'custom'] },
    scanResolutionNote: String,
    colorTone: {
      type: String,
      enum: ['natural', 'warm', 'cool', 'high_contrast', 'custom'],
    },
    colorToneNote: String,
    technicalNotes: String,
    contactVerified: { type: Boolean, default: false },
    contactName: String,
    contactPhone: String,
    contactEmail: String,
    promisedReturnAt: Date,
    originalFilmReturn: {
      type: String,
      enum: ['pickup_at_lab', 'ship_home', 'discard', 'undecided'],
    },
    shippingAddress: String,
    paymentStatus: { type: String, enum: ['paid_full', 'deposit', 'unpaid'] },
    paymentAmount: Number,
    paymentNote: String,
    checklistCompletedAt: Date,
    inspectedBy: String,
  },
  statusHistory: [
    {
      status: String,
      note: String,
      at: { type: Date, default: Date.now },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  ],
  deliverySlug: { type: String, unique: true, sparse: true, index: true },
  deliveryFiles: [
    {
      filename: String,
      originalName: String,
      size: Number,
      mimeType: String,
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
  emailSentAt: Date,
  completionEmailSentAt: Date,
  driveFolderId: String,
  driveWebViewLink: String,
  driveSyncedAt: Date,
  deliveryEmailSentAt: Date,
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
