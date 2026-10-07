const mongoose = require('mongoose');

const filmStockSchema = new mongoose.Schema({
  sku_code: { type: String, required: true, uppercase: true, index: true },
  barcode: { type: String, uppercase: true, index: true },
  name: { type: String, required: true },
  brand: String,
  brand_group: { type: String, uppercase: true, index: true },
  category_cluster: String,
  iso: Number,
  film_type: String,
  exposures: String,
  color_character: String,
  catalog_key: String,
  size: { type: String, enum: ['35mm', '120', '110', 'other'], default: '35mm' },
  quantity: { type: Number, required: true, default: 0, min: 0 },
  expiry_date: { type: Date, required: true, index: true },
  cost: { type: Number, default: 0, min: 0 },
  price: { type: Number, default: 0, min: 0 },
  floor_price: { type: Number, default: 0, min: 0 },
  cost_history: [
    {
      date: { type: Date, default: Date.now },
      cost: { type: Number, min: 0 },
    },
  ],
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

filmStockSchema.index({ sku_code: 1, expiry_date: 1 });

module.exports = mongoose.model('Film_Stock', filmStockSchema);
