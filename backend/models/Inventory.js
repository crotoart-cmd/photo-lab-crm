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
  quantityMl: {
    type: Number,
    default: 0,
  },
  unit: {
    type: String,
    default: 'piece',
  },
  lotCode: String,
  expiryDate: Date,
  filmFormat: {
    type: String,
    enum: ['35mm', '120', 'large_format', '110', 'sheet', 'other'],
  },
  iso: Number,
  filmType: {
    type: String,
    enum: ['color_negative', 'black_white', 'color_positive'],
  },
  serialNumber: String,
  cameraCondition: String,
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
  naturalLossPercent: {
    type: Number,
    default: 0,
  },
  maxRollCapacity: Number,
  processedRollCount: {
    type: Number,
    default: 0,
  },
  consumptionRecipe: [
    {
      processCode: {
        type: String,
        enum: ['c41', 'ecn2', 'bw_standard', 'bw_custom', 'e6', 'other'],
      },
      filmFormat: {
        type: String,
        enum: ['35mm', '120', '110', 'other'],
      },
      mlPerRoll: {
        type: Number,
        min: 0,
      },
    },
  ],
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

inventorySchema.pre('save', function normalizeQuantity(next) {
  if (this.category === 'chemical') {
    const normalizedUnit = String(this.unit || '').toLowerCase();
    if (!this.unit || this.unit === 'piece') this.unit = 'ml';
    if (['l', 'lit', 'liter', 'lít'].includes(normalizedUnit)) {
      this.quantityMl = Number(this.quantity || 0) * 1000;
      this.unit = 'L';
    } else {
      this.quantityMl = Number(this.quantity || 0);
      this.unit = 'ml';
    }
  } else {
    this.quantityMl = 0;
  }
  next();
});

module.exports = mongoose.model('Inventory', inventorySchema);
