/**
 * Master catalog service — nguồn dữ liệu chính thức (film + máy ảnh).
 * Mọi auto-fill (nhập kho, quét mã, AI vision) resolve qua đây.
 *
 * Data files:
 *   backend/data/cameraFilmCatalog.js  — máy ảnh film
 *   backend/data/filmStockCatalog.js   — cuộn film
 */

const CAMERA_CATALOG = require('../data/cameraFilmCatalog');
const FILM_CATALOG = require('../data/filmStockCatalog');
const { catalogToIntakePayload: cameraToIntake } = require('./cameraSerialService');
const { catalogToIntakePayload: filmToIntake, findBySku, getCatalogEntry: getFilmEntry } = require('./filmCatalogService');

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const CAMERA_TYPE_ALIASES = {
  slr: 'SLR',
  rf: 'Rangefinder',
  rangefinder: 'Rangefinder',
  pns: 'PnS',
  pointandshoot: 'PnS',
  compact: 'PnS',
  tlr: 'TLR',
  other: 'Other',
  khac: 'Other',
};

function normalizeCameraType(raw) {
  if (!raw) return null;
  const key = norm(raw);
  return CAMERA_TYPE_ALIASES[key] || (['SLR', 'Rangefinder', 'PnS', 'TLR', 'Other'].includes(raw) ? raw : null);
}

function getCameraEntry(catalogKey) {
  return CAMERA_CATALOG.find((c) => c.catalogKey === catalogKey) || null;
}

function getCameraBrands() {
  return [...new Set(CAMERA_CATALOG.map((c) => c.brand))].sort((a, b) => a.localeCompare(b, 'vi'));
}

function getCameraModelsByBrand(brand) {
  const b = String(brand || '').trim();
  if (!b) return [];
  return CAMERA_CATALOG.filter((c) => c.brand === b);
}

function getFilmBrands() {
  return [...new Set(FILM_CATALOG.map((f) => f.brand))].sort((a, b) => a.localeCompare(b, 'vi'));
}

function scoreModelMatch(entry, modelText) {
  const nm = norm(modelText);
  if (!nm) return 0;
  const full = norm(entry.model);
  const short = norm(entry.model.replace(entry.brand, ''));
  if (full === nm || short === nm) return 100;
  if (full.includes(nm) || nm.includes(full)) return 80;
  if (short && (short.includes(nm) || nm.includes(short))) return 70;
  if (norm(entry.catalogKey).includes(nm)) return 50;
  return 0;
}

/**
 * Tìm dòng máy trong master data.
 * @returns {{ entry: object, confidence: 'exact'|'brand_model'|'fuzzy' } | null}
 */
function resolveCamera({ catalogKey, brand, model, query } = {}) {
  if (catalogKey) {
    const entry = getCameraEntry(catalogKey);
    if (entry) return { entry, confidence: 'exact' };
  }

  const nb = norm(brand);
  let pool = nb ? CAMERA_CATALOG.filter((c) => norm(c.brand) === nb) : CAMERA_CATALOG;

  const modelText = model || query;
  if (modelText) {
    let best = null;
    let bestScore = 0;
    for (const entry of pool) {
      const score = scoreModelMatch(entry, modelText);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    if (best && bestScore >= 50) {
      return { entry: best, confidence: bestScore >= 80 ? 'brand_model' : 'fuzzy' };
    }
  }

  if (query && !model) {
    const nq = norm(query);
    const hit = CAMERA_CATALOG.find((c) => norm(c.model).includes(nq) || nq.includes(norm(c.model)));
    if (hit) return { entry: hit, confidence: 'fuzzy' };
  }

  return null;
}

function resolveFilm({ catalogKey, sku, name, brand } = {}) {
  if (catalogKey) {
    const entry = getFilmEntry(catalogKey);
    if (entry) return { entry, confidence: 'exact' };
  }
  if (sku) {
    const entry = findBySku(sku) || FILM_CATALOG.find((f) => norm(f.skuTemplate) === norm(sku));
    if (entry) return { entry, confidence: 'exact' };
  }
  const text = norm(name || '');
  if (text) {
    const pool = brand ? FILM_CATALOG.filter((f) => norm(f.brand) === norm(brand)) : FILM_CATALOG;
    const hit = pool.find((f) => norm(f.name).includes(text) || text.includes(norm(f.name)));
    if (hit) return { entry: hit, confidence: 'fuzzy' };
  }
  return null;
}

/**
 * Gộp payload nhập kho với master data (ưu tiên catalog chính thức).
 */
function fillCameraIntake(partial = {}) {
  const resolved = resolveCamera({
    catalogKey: partial.catalog_key,
    brand: partial.brand,
    model: partial.model_name || partial.model || partial.name,
    query: partial.model_name || partial.name,
  });

  if (resolved) {
    const fromMaster = cameraToIntake(resolved.entry);
    return {
      ...partial,
      ...fromMaster,
      catalog_key: resolved.entry.catalogKey,
      brand: resolved.entry.brand,
      model_name: resolved.entry.model,
      name: resolved.entry.model,
      camera_type: resolved.entry.cameraType,
      master_match: resolved.confidence,
      serial_number: partial.serial_number || fromMaster.serial_number || '',
      cost: partial.cost ?? fromMaster.cost,
      price: partial.price ?? fromMaster.price,
      floor_price: partial.floor_price ?? fromMaster.floor_price,
      condition_note: partial.condition_note || fromMaster.condition_note || '',
      note: partial.note || fromMaster.note,
    };
  }

  const aiType = normalizeCameraType(partial.camera_type || partial.type);
  return {
    ...partial,
    product_group: partial.product_group || 'camera',
    camera_type: aiType || partial.camera_type || 'Other',
    master_match: null,
  };
}

function fillFilmIntake(partial = {}, options = {}) {
  const resolved = resolveFilm({
    catalogKey: partial.catalog_key,
    sku: partial.sku_code,
    name: partial.name,
    brand: partial.brand,
  });

  if (resolved) {
    const fromMaster = filmToIntake(resolved.entry, { format: options.format || partial.size });
    return {
      ...partial,
      ...fromMaster,
      catalog_key: resolved.entry.catalogKey,
      master_match: resolved.confidence,
      cost: partial.cost ?? fromMaster.cost,
      price: partial.price ?? fromMaster.price,
      floor_price: partial.floor_price ?? fromMaster.floor_price,
    };
  }

  return { ...partial, product_group: partial.product_group || 'film', master_match: null };
}

function getMasterSummary() {
  const cameraTypes = {};
  CAMERA_CATALOG.forEach((c) => {
    cameraTypes[c.cameraType] = (cameraTypes[c.cameraType] || 0) + 1;
  });
  return {
    version: 1,
    role: 'official_master_data',
    camera: {
      brands: getCameraBrands().length,
      models: CAMERA_CATALOG.length,
      types: cameraTypes,
      source: 'backend/data/cameraFilmCatalog.js',
    },
    film: {
      brands: getFilmBrands().length,
      stocks: FILM_CATALOG.length,
      source: 'backend/data/filmStockCatalog.js',
    },
  };
}

module.exports = {
  CAMERA_CATALOG,
  FILM_CATALOG,
  getCameraEntry,
  getCameraBrands,
  getCameraModelsByBrand,
  getFilmBrands,
  resolveCamera,
  resolveFilm,
  fillCameraIntake,
  fillFilmIntake,
  getMasterSummary,
  normalizeCameraType,
};
