const Inventory = require('../models/Inventory');
const InventoryLog = require('../models/InventoryLog');

const processFromFilm = (film) => film.intakeChecklist?.processingProcess || 'other';
const formatFromFilm = (film) => film.intakeChecklist?.filmFormat || 'other';

const pickRecipe = (item, processCode, filmFormat) => {
  if (!Array.isArray(item.consumptionRecipe) || item.consumptionRecipe.length === 0) return null;
  return (
    item.consumptionRecipe.find((recipe) => recipe.processCode === processCode && recipe.filmFormat === filmFormat) ||
    item.consumptionRecipe.find((recipe) => recipe.processCode === processCode) ||
    null
  );
};

async function createInventoryLog(payload) {
  await InventoryLog.create(payload);
}

async function consumeChemicalsForFilm(film, userId) {
  const processCode = processFromFilm(film);
  const filmFormat = formatFromFilm(film);
  const rollQty = Number(film.quantity || 1);
  const chemicals = await Inventory.find({ category: 'chemical' });
  const updates = [];

  for (const item of chemicals) {
    const recipe = pickRecipe(item, processCode, filmFormat);
    if (!recipe || !recipe.mlPerRoll) continue;

    const consumeMl = Number(recipe.mlPerRoll) * rollQty;
    item.quantityMl = Math.max(0, Number(item.quantityMl || 0) - consumeMl);
    item.quantity = item.unit === 'L' ? Number((item.quantityMl / 1000).toFixed(3)) : item.quantityMl;
    item.processedRollCount = Number(item.processedRollCount || 0) + rollQty;
    item.updatedAt = Date.now();
    await item.save();

    await createInventoryLog({
      inventoryItemId: item._id,
      itemName: item.itemName,
      category: item.category,
      actionType: 'consume',
      quantityChange: -consumeMl,
      quantityAfter: item.quantityMl,
      unit: 'ml',
      reason: `Do tráng đơn ${film.ticketNumber || film.filmCode}`,
      referenceCode: film.ticketNumber || film.filmCode,
      createdBy: userId,
      metadata: { processCode, filmFormat, rollQty },
    });

    updates.push({
      itemId: item._id,
      itemName: item.itemName,
      consumeMl,
      quantityAfterMl: item.quantityMl,
      isLow: item.quantityMl <= Number(item.minStock || 0),
      reachedCapacity:
        item.maxRollCapacity && Number(item.processedRollCount || 0) >= Number(item.maxRollCapacity),
    });
  }

  return updates;
}

module.exports = {
  createInventoryLog,
  consumeChemicalsForFilm,
};
