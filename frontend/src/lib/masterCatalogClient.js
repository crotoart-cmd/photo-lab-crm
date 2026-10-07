/** Client-side master catalog → payload nhập kho (khớp backend masterCatalogService) */

export function skuForFormat(entry, format) {
  const base = String(entry?.skuTemplate || '').toUpperCase();
  const fmt = format || entry?.formats?.[0] || '35mm';
  if (fmt === '120') return base.replace(/-35$/, '-120');
  if (fmt === '110') return base.replace(/-35$/, '-110');
  return base;
}

export function cameraEntryToIntake(entry) {
  if (!entry) return null;
  return {
    product_group: 'camera',
    source: 'catalog',
    catalog_key: entry.catalogKey,
    brand: entry.brand,
    model_name: entry.model,
    name: entry.model,
    camera_type: entry.cameraType,
    brand_group: String(entry.brand || '')
      .toUpperCase()
      .replace(/\s+/g, ''),
    category_cluster: `CAMERA ${entry.cameraType}`,
    master_match: 'exact',
    note: entry.notes || '',
  };
}

export function filmEntryToIntake(entry, format) {
  if (!entry) return null;
  const fmt = format || entry.formats?.[0] || '35mm';
  const size =
    fmt === '120' ? '120' : fmt === '110' ? '110' : fmt === '35mm' ? '35mm' : 'other';
  return {
    product_group: 'film',
    source: 'catalog',
    catalog_key: entry.catalogKey,
    sku_code: skuForFormat(entry, fmt),
    name: entry.name,
    brand: entry.brand,
    brand_group: entry.brand_group || String(entry.brand || '').toUpperCase().replace(/\s+/g, ''),
    category_cluster: entry.category_cluster || `FILM ${entry.filmType || ''}`.trim(),
    iso: entry.iso,
    size,
    film_type: entry.filmType,
    exposures: entry.exposures,
    color_character: entry.colorCharacter,
    formats: entry.formats,
    master_match: 'exact',
    note: `${entry.filmType || ''} · ${entry.colorCharacter || ''}`.trim(),
  };
}

export function findCameraEntry(catalogKey, list) {
  return list.find((c) => c.catalogKey === catalogKey) || null;
}

export function findFilmEntry(catalogKey, list) {
  return list.find((f) => f.catalogKey === catalogKey) || null;
}
