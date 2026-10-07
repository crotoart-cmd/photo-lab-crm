const mongoose = require('mongoose');

const cameraRepairEventSchema = new mongoose.Schema({
  camera_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Camera_Stock', required: true, index: true },
  date: { type: Date, default: Date.now, index: true },
  vendor: String,
  description: { type: String, required: true },
  parts_cost: { type: Number, default: 0, min: 0 },
  labor_cost: { type: Number, default: 0, min: 0 },
  total_cost: { type: Number, default: 0, min: 0 },
  before_note: String,
  after_note: String,
  resolved_tags: [String],
  mark_ready: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Camera_Repair_Event', cameraRepairEventSchema);
