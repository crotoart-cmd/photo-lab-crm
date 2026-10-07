const mongoose = require('mongoose');

const retailSaleSchema = new mongoose.Schema({
  sale_code: { type: String, required: true, unique: true, index: true },
  product_group: { type: String, enum: ['film', 'battery', 'camera'], required: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  list_price: { type: Number, default: 0, min: 0 },
  unit_price: { type: Number, required: true, min: 0 },
  unit_cost: { type: Number, default: 0, min: 0 },
  total_amount: { type: Number, required: true, min: 0 },
  total_cost: { type: Number, default: 0, min: 0 },
  profit: { type: Number, default: 0 },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  buyerName: String,
  buyerEmail: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Retail_Sale', retailSaleSchema);
