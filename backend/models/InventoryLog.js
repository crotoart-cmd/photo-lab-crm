const mongoose = require('mongoose');

const inventoryLogSchema = new mongoose.Schema({
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true,
  },
  itemName: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['chemical', 'film', 'camera', 'supplies'],
    required: true,
  },
  actionType: {
    type: String,
    enum: ['import', 'consume', 'adjustment', 'natural_loss', 'manual_update'],
    required: true,
  },
  quantityChange: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  referenceCode: String,
  quantityAfter: Number,
  metadata: mongoose.Schema.Types.Mixed,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);
