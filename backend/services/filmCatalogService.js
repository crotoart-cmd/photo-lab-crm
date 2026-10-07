const FILM_CATALOG = require('../data/filmStockCatalog');

const getCatalogEntry = (catalogKey) =>
  FILM_CATALOG.find((f) => f.catalogKey === catalogKey) || null;

const findBySku = (sku) => {
  const upper = String(sku || '').toUpperCase();
  return FILM_CATALOG.find((f) => f.skuTemplate === upper) || null;
};

function skuForFormat(entry, format) {
  const base = String(entry?.skuTemplate || '').toUpperCase();
  const fmt = format || entry?.formats?.[0] || '35mm';
  if (fmt === '120') return base.replace(/-35$/, '-120');
  if (fmt === '110') return base.replace(/-35$/, '-110');
  return base;
}

function catalogToIntakePayload(entry, options = {}) {
  const format = options.format || entry.formats[0] || '35mm';
  const size =
    format === '120' ? '120' : format === '110' ? '110' : format === '35mm' ? '35mm' : 'other';

  return {
    product_group: 'film',
    source: 'catalog',
    catalog_key: entry.catalogKey,
    sku_code: skuForFormat(entry, format),
    name: entry.name,
    brand: entry.brand,
    brand_group: entry.brand_group,
    category_cluster: entry.category_cluster,
    iso: entry.iso,
    size,
    film_type: entry.filmType,
    exposures: entry.exposures,
    color_character: entry.colorCharacter,
    formats: entry.formats,
    note: `${entry.filmType} · ${entry.colorCharacter}`,
  };
}

module.exports = {
  FILM_CATALOG,
  getCatalogEntry,
  findBySku,
  skuForFormat,
  catalogToIntakePayload,
};
