/**
 * Tồn kho thuốc tráng / vật tư — lưu cục bộ trên máy.
 */
import {
  loadInventory,
  saveInventory,
  loadInventoryLogs,
  saveInventoryLogs,
  newLocalId,
} from './mobileLocalDb';

const num = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function itemQty(item) {
  return item.category === 'chemical' ? num(item.quantityMl) : num(item.quantity);
}

function isLowStock(item) {
  return itemQty(item) <= num(item.minStock);
}

function normalizeItemFields(payload = {}, existing = null) {
  const category = payload.category || existing?.category || 'chemical';
  const quantity = num(payload.quantity, existing ? num(existing.quantity) : 0);
  const unit = payload.unit || existing?.unit || (category === 'chemical' ? 'ml' : 'piece');

  let quantityMl = existing?.quantityMl;
  if (category === 'chemical') {
    if (payload.quantityMl != null) quantityMl = num(payload.quantityMl);
    else if (payload.quantity != null) {
      quantityMl = unit === 'L' ? quantity * 1000 : quantity;
    } else if (quantityMl == null) {
      quantityMl = unit === 'L' ? quantity * 1000 : quantity;
    }
  }

  return {
    ...(existing || {}),
    ...payload,
    category,
    quantity,
    unit,
    quantityMl: category === 'chemical' ? quantityMl : undefined,
    minStock: num(payload.minStock, existing ? num(existing.minStock) : 0),
    maxStock: num(payload.maxStock, existing ? num(existing.maxStock) : 0),
    naturalLossPercent: num(
      payload.naturalLossPercent,
      existing ? num(existing.naturalLossPercent) : 0
    ),
    maxRollCapacity:
      payload.maxRollCapacity !== '' && payload.maxRollCapacity != null
        ? num(payload.maxRollCapacity)
        : existing?.maxRollCapacity,
    price:
      payload.price !== '' && payload.price != null ? num(payload.price) : existing?.price,
    iso: payload.iso !== '' && payload.iso != null ? num(payload.iso) : existing?.iso,
    consumptionRecipe: Array.isArray(payload.consumptionRecipe)
      ? payload.consumptionRecipe
      : existing?.consumptionRecipe || [],
  };
}

function appendLog(log) {
  const logs = loadInventoryLogs();
  logs.unshift(log);
  saveInventoryLogs(logs.slice(0, 500));
  return log;
}

export function listInventoryLocal({ category, lowStock } = {}) {
  let items = loadInventory();
  if (category) items = items.filter((i) => i.category === category);
  if (lowStock === true || lowStock === 'true') items = items.filter(isLowStock);
  return items.sort((a, b) => String(a.itemName || '').localeCompare(String(b.itemName || ''), 'vi'));
}

export function listInventoryLogsLocal({ limit = 60 } = {}) {
  return loadInventoryLogs().slice(0, Number(limit) || 60);
}

export function getInventoryAlertsLocal() {
  const items = loadInventory();
  const lowStockItems = items.filter(isLowStock);
  const overCapacityChemicals = items.filter(
    (item) =>
      item.category === 'chemical' &&
      item.maxRollCapacity &&
      num(item.processedRollCount) >= num(item.maxRollCapacity)
  );
  return {
    lowStockCount: lowStockItems.length,
    lowStockItems: lowStockItems.slice(0, 20),
    overCapacityCount: overCapacityChemicals.length,
    overCapacityChemicals,
  };
}

export function upsertInventoryLocal(payload = {}, editingId = null) {
  const now = new Date().toISOString();
  const rows = loadInventory();

  if (editingId) {
    const idx = rows.findIndex((i) => String(i._id) === String(editingId));
    if (idx < 0) throw new Error('Không tìm thấy mặt hàng');
    const next = {
      ...normalizeItemFields(payload, rows[idx]),
      _id: editingId,
      updatedAt: now,
      _local: rows[idx]._local || false,
      _pendingSync: true,
    };
    rows[idx] = next;
    saveInventory(rows);
    appendLog({
      _id: newLocalId(),
      inventoryItemId: editingId,
      itemName: next.itemName,
      category: next.category,
      actionType: 'manual_update',
      quantityChange: 0,
      quantityAfter: itemQty(next),
      unit: next.category === 'chemical' ? 'ml' : next.unit || 'piece',
      reason: 'Cập nhật thông tin mặt hàng',
      createdAt: now,
      _local: true,
    });
    return next;
  }

  const id = newLocalId();
  const item = {
    ...normalizeItemFields(payload),
    _id: id,
    itemName: String(payload.itemName || '').trim(),
    processedRollCount: 0,
    createdAt: now,
    updatedAt: now,
    _local: true,
    _pendingSync: true,
  };
  if (!item.itemName) throw new Error('Tên hàng là bắt buộc');
  rows.unshift(item);
  saveInventory(rows);
  appendLog({
    _id: newLocalId(),
    inventoryItemId: id,
    itemName: item.itemName,
    category: item.category,
    actionType: 'import',
    quantityChange: itemQty(item),
    quantityAfter: itemQty(item),
    unit: item.category === 'chemical' ? 'ml' : item.unit || 'piece',
    reason: 'Nhập kho gốc',
    createdAt: now,
    _local: true,
  });
  return item;
}

export function adjustInventoryLocal(id, { quantity, restock, reason, actionType } = {}) {
  const rows = loadInventory();
  const idx = rows.findIndex((i) => String(i._id) === String(id));
  if (idx < 0) throw new Error('Không tìm thấy mặt hàng');

  const item = { ...rows[idx] };
  const changeQty = num(quantity);
  const now = new Date().toISOString();
  let qtyAfter = 0;
  let qtyChange = 0;
  let unit = item.unit || 'piece';

  if (restock) {
    if (item.category === 'chemical') {
      item.quantityMl = num(item.quantityMl) + changeQty;
      item.quantity =
        item.unit === 'L' ? Number((item.quantityMl / 1000).toFixed(3)) : item.quantityMl;
      qtyAfter = item.quantityMl;
      qtyChange = changeQty;
      unit = 'ml';
    } else {
      item.quantity = num(item.quantity) + changeQty;
      qtyAfter = item.quantity;
      qtyChange = changeQty;
    }
    item.lastRestockDate = now;
  } else {
    const oldQty = itemQty(item);
    if (item.category === 'chemical') {
      item.quantityMl = changeQty;
      item.quantity =
        item.unit === 'L' ? Number((item.quantityMl / 1000).toFixed(3)) : item.quantityMl;
      qtyAfter = item.quantityMl;
      qtyChange = changeQty - oldQty;
      unit = 'ml';
    } else {
      item.quantity = changeQty;
      qtyAfter = item.quantity;
      qtyChange = changeQty - oldQty;
    }
  }

  item.updatedAt = now;
  item._pendingSync = true;
  rows[idx] = item;
  saveInventory(rows);
  appendLog({
    _id: newLocalId(),
    inventoryItemId: id,
    itemName: item.itemName,
    category: item.category,
    actionType: actionType || (restock ? 'import' : 'adjustment'),
    quantityChange: qtyChange,
    quantityAfter: qtyAfter,
    unit,
    reason: reason || (restock ? 'Nhập thêm kho' : 'Cân bằng kho'),
    createdAt: now,
    _local: true,
  });
  return item;
}

export function applyNaturalLossLocal({ percent, reason } = {}) {
  const usedPercent = num(percent);
  const rows = loadInventory();
  const updates = [];
  const now = new Date().toISOString();

  for (let i = 0; i < rows.length; i += 1) {
    const item = rows[i];
    if (item.category !== 'chemical') continue;
    const lossPercent = usedPercent > 0 ? usedPercent : num(item.naturalLossPercent);
    if (lossPercent <= 0) continue;
    const oldMl = num(item.quantityMl);
    const lossMl = Number(((oldMl * lossPercent) / 100).toFixed(2));
    const next = {
      ...item,
      quantityMl: Math.max(0, oldMl - lossMl),
      updatedAt: now,
      _pendingSync: true,
    };
    next.quantity =
      next.unit === 'L' ? Number((next.quantityMl / 1000).toFixed(3)) : next.quantityMl;
    rows[i] = next;
    appendLog({
      _id: newLocalId(),
      inventoryItemId: next._id,
      itemName: next.itemName,
      category: next.category,
      actionType: 'natural_loss',
      quantityChange: -lossMl,
      quantityAfter: next.quantityMl,
      unit: 'ml',
      reason: reason || `Hao hụt tự nhiên ${lossPercent}%`,
      createdAt: now,
      _local: true,
    });
    updates.push({
      id: next._id,
      itemName: next.itemName,
      lossMl,
      quantityAfterMl: next.quantityMl,
    });
  }

  saveInventory(rows);
  return { message: 'Đã áp hao hụt tự nhiên', updates };
}

export function mergeInventoryFromServer(serverItems = []) {
  if (!Array.isArray(serverItems) || serverItems.length === 0) return;
  const local = loadInventory();
  const byId = new Map(local.map((i) => [String(i._id), i]));
  for (const item of serverItems) {
    const id = String(item._id || '');
    if (!id) continue;
    const existing = byId.get(id);
    const serverAt = new Date(item.updatedAt || 0).getTime();
    const localAt = existing ? new Date(existing.updatedAt || 0).getTime() : 0;
    if (!existing || serverAt >= localAt) {
      byId.set(id, { ...existing, ...item, _id: id, _local: false });
    }
  }
  saveInventory([...byId.values()]);
}

export function mergeInventoryLogsFromServer(serverLogs = []) {
  if (!Array.isArray(serverLogs) || serverLogs.length === 0) return;
  const local = loadInventoryLogs();
  const byId = new Map(local.map((l) => [String(l._id), l]));
  for (const log of serverLogs) {
    const id = String(log._id || '');
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, log);
  }
  saveInventoryLogs(
    [...byId.values()].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    )
  );
}
