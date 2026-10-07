const express = require('express');
const Inventory = require('../models/Inventory');
const InventoryLog = require('../models/InventoryLog');
const { verifyToken } = require('./auth');
const { createInventoryLog } = require('../services/inventoryService');

const router = express.Router();

const itemQty = (item) => (item.category === 'chemical' ? Number(item.quantityMl || 0) : Number(item.quantity || 0));
const lowStockFilter = (item) => itemQty(item) <= Number(item.minStock || 0);

router.get('/', verifyToken, async (req, res) => {
  try {
    const { category, lowStock, format, filmType, processCode } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (format) filter.filmFormat = format;
    if (filmType) filter.filmType = filmType;
    if (processCode) filter['consumptionRecipe.processCode'] = processCode;

    let items = await Inventory.find(filter).sort({ itemName: 1 });

    if (lowStock === 'true') {
      items = items.filter(lowStockFilter);
    }

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory', error: error.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const item = new Inventory(req.body);
    await item.save();
    await createInventoryLog({
      inventoryItemId: item._id,
      itemName: item.itemName,
      category: item.category,
      actionType: 'import',
      quantityChange: item.category === 'chemical' ? Number(item.quantityMl || 0) : Number(item.quantity || 0),
      quantityAfter: item.category === 'chemical' ? Number(item.quantityMl || 0) : Number(item.quantity || 0),
      unit: item.category === 'chemical' ? 'ml' : item.unit || 'piece',
      reason: 'Nhập kho gốc',
      createdBy: req.userId,
    });
    res.status(201).json({ message: 'Inventory item created', item });
  } catch (error) {
    res.status(500).json({ message: 'Error creating inventory item', error: error.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching item', error: error.message });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    Object.assign(item, req.body, { updatedAt: Date.now() });
    await item.save();
    await createInventoryLog({
      inventoryItemId: item._id,
      itemName: item.itemName,
      category: item.category,
      actionType: 'manual_update',
      quantityChange: 0,
      quantityAfter: item.category === 'chemical' ? Number(item.quantityMl || 0) : Number(item.quantity || 0),
      unit: item.category === 'chemical' ? 'ml' : item.unit || 'piece',
      reason: 'Cập nhật thông tin mặt hàng',
      createdBy: req.userId,
    });
    res.json({ message: 'Item updated', item });
  } catch (error) {
    res.status(500).json({ message: 'Error updating item', error: error.message });
  }
});

router.patch('/:id/quantity', verifyToken, async (req, res) => {
  try {
    const { quantity, restock, reason, referenceCode, actionType } = req.body;
    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const changeQty = Number(quantity);
    let qtyAfter = 0;
    let qtyChange = 0;
    let unit = item.unit || 'piece';

    if (restock) {
      if (item.category === 'chemical') {
        item.quantityMl = Number(item.quantityMl || 0) + changeQty;
        item.quantity = item.unit === 'L' ? Number((item.quantityMl / 1000).toFixed(3)) : item.quantityMl;
        qtyAfter = item.quantityMl;
        qtyChange = changeQty;
        unit = 'ml';
      } else {
        item.quantity += changeQty;
        qtyAfter = item.quantity;
        qtyChange = changeQty;
      }
      item.lastRestockDate = Date.now();
    } else {
      const oldQty = item.category === 'chemical' ? Number(item.quantityMl || 0) : Number(item.quantity || 0);
      if (item.category === 'chemical') {
        item.quantityMl = changeQty;
        item.quantity = item.unit === 'L' ? Number((item.quantityMl / 1000).toFixed(3)) : item.quantityMl;
        qtyAfter = item.quantityMl;
        qtyChange = changeQty - oldQty;
        unit = 'ml';
      } else {
        item.quantity = changeQty;
        qtyAfter = item.quantity;
        qtyChange = changeQty - oldQty;
      }
    }

    item.updatedAt = Date.now();
    await item.save();
    await createInventoryLog({
      inventoryItemId: item._id,
      itemName: item.itemName,
      category: item.category,
      actionType: actionType || (restock ? 'import' : 'adjustment'),
      quantityChange: qtyChange,
      quantityAfter: qtyAfter,
      unit,
      reason: reason || (restock ? 'Nhập thêm kho' : 'Cân bằng kho'),
      referenceCode,
      createdBy: req.userId,
    });

    res.json({ message: 'Quantity updated', item });
  } catch (error) {
    res.status(500).json({ message: 'Error updating quantity', error: error.message });
  }
});

router.post('/apply-natural-loss', verifyToken, async (req, res) => {
  try {
    const { itemId, percent, reason } = req.body;
    const filter = itemId ? { _id: itemId, category: 'chemical' } : { category: 'chemical' };
    const items = await Inventory.find(filter);
    const usedPercent = Number(percent || 0);

    const updates = [];
    for (const item of items) {
      const lossPercent = usedPercent > 0 ? usedPercent : Number(item.naturalLossPercent || 0);
      if (lossPercent <= 0) continue;
      const oldMl = Number(item.quantityMl || 0);
      const lossMl = Number(((oldMl * lossPercent) / 100).toFixed(2));
      item.quantityMl = Math.max(0, oldMl - lossMl);
      item.quantity = item.unit === 'L' ? Number((item.quantityMl / 1000).toFixed(3)) : item.quantityMl;
      item.updatedAt = Date.now();
      await item.save();
      await createInventoryLog({
        inventoryItemId: item._id,
        itemName: item.itemName,
        category: item.category,
        actionType: 'natural_loss',
        quantityChange: -lossMl,
        quantityAfter: item.quantityMl,
        unit: 'ml',
        reason: reason || `Hao hụt tự nhiên ${lossPercent}%`,
        createdBy: req.userId,
      });
      updates.push({ id: item._id, itemName: item.itemName, lossMl, quantityAfterMl: item.quantityMl });
    }

    res.json({ message: 'Applied natural loss', updates });
  } catch (error) {
    res.status(500).json({ message: 'Error applying natural loss', error: error.message });
  }
});

router.get('/meta/logs', verifyToken, async (req, res) => {
  try {
    const { actionType, limit = 100 } = req.query;
    const filter = {};
    if (actionType) filter.actionType = actionType;
    const logs = await InventoryLog.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching logs', error: error.message });
  }
});

router.get('/meta/alerts', verifyToken, async (req, res) => {
  try {
    const items = await Inventory.find().sort({ itemName: 1 });
    const lowStockItems = items.filter(lowStockFilter);
    const overCapacityChemicals = items.filter(
      (item) =>
        item.category === 'chemical' &&
        item.maxRollCapacity &&
        Number(item.processedRollCount || 0) >= Number(item.maxRollCapacity || 0)
    );
    res.json({
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.slice(0, 20),
      overCapacityCount: overCapacityChemicals.length,
      overCapacityChemicals,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching alerts', error: error.message });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting item', error: error.message });
  }
});

module.exports = router;
