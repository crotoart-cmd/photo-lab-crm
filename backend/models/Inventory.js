const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['chemical', 'film', 'camera', 'supplies'],
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
  },
  unit: {
    type: String,
    default: 'piece',
  },
  minStock: {
    type: Number,
    default: 5,
  },
  maxStock: {
    type: Number,
    default: 100,
  },
  price: Number,
  supplier: String,
  lastRestockDate: Date,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Inventory', inventorySchema);
