const mongoose = require('mongoose');
const { CAMERA_STATUSES, CONDITION_GRADES } = require('../constants/cameraLifecycle');

const timelineEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    type: { type: String, enum: ['intake', 'repair', 'status', 'sale', 'note'], default: 'note' },
    summary: String,
    meta: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const cameraStockSchema = new mongoose.Schema({
  camera_code: { type: String, required: true, unique: true, uppercase: true, index: true },
  barcode: { type: String, uppercase: true, index: true },
  model_name: { type: String, required: true },
  brand: String,
  camera_type: { type: String, enum: ['SLR', 'Rangefinder', 'PnS', 'TLR', 'Other'], default: 'Other' },
  catalog_key: { type: String, index: true },
  serial_is_generated: { type: Boolean, default: false },
  estimated_year: Number,
  brand_group: { type: String, uppercase: true, index: true },
  category_cluster: String,
  serial_number: { type: String, required: true, unique: true, uppercase: true },
  status: {
    type: String,
    enum: CAMERA_STATUSES,
    default: 'San_Hang',
    index: true,
  },
  condition_grade: { type: String, enum: CONDITION_GRADES, default: 'A' },
  has_defect: { type: Boolean, default: false, index: true },
  defect_tags: [{ type: String }],
  condition_note: String,
  cost: { type: Number, default: 0, min: 0 },
  total_repair_cost: { type: Number, default: 0, min: 0 },
  price: { type: Number, default: 0, min: 0 },
  floor_price: { type: Number, default: 0, min: 0 },
  cost_history: [
    {
      date: { type: Date, default: Date.now },
      cost: { type: Number, min: 0 },
      type: { type: String, enum: ['purchase', 'repair'], default: 'purchase' },
      note: String,
    },
  ],
  timeline: [timelineEntrySchema],
  sold_at: Date,
  sold_price: Number,
  sold_note: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Camera_Stock', cameraStockSchema);
