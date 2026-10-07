const mongoose = require('mongoose');

const batteryStockSchema = new mongoose.Schema({
  sku_code: { type: String, required: true, unique: true, uppercase: true },
  barcode: { type: String, uppercase: true, index: true },
  name: { type: String, required: true },
  brand_group: { type: String, uppercase: true, index: true },
  category_cluster: String,
  battery_type: { type: String, required: true },
  brand: String,
  quantity: { type: Number, required: true, default: 0, min: 0 },
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

module.exports = mongoose.model('Battery_Stock', batteryStockSchema);
