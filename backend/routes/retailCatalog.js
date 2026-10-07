const express = require('express');
const { verifyToken } = require('./auth');
const {
  validateCameraSerial,
  generateCounterCode,
  catalogToIntakePayload,
  findCatalogBySerial,
} = require('../services/cameraSerialService');
const { FILM_CATALOG, getCatalogEntry, catalogToIntakePayload: filmToIntake } = require('../services/filmCatalogService');
const {
  CAMERA_CATALOG,
  getCameraBrands,
  getCameraModelsByBrand,
  getFilmBrands,
  getMasterSummary,
  resolveCamera,
  resolveFilm,
  fillCameraIntake,
  fillFilmIntake,
} = require('../services/masterCatalogService');

const router = express.Router();

/** Meta — master data chính thức */
router.get('/master', verifyToken, (_req, res) => {
  res.json(getMasterSummary());
});

router.get('/camera-models', verifyToken, (_req, res) => {
  res.json(CAMERA_CATALOG);
});

router.get('/camera-brands', verifyToken, (_req, res) => {
  res.json(getCameraBrands());
});

router.get('/camera-models-by-brand', verifyToken, (req, res) => {
  const brand = String(req.query.brand || '').trim();
  if (!brand) return res.status(400).json({ message: 'Thiếu query brand' });
  res.json(getCameraModelsByBrand(brand));
});

router.get('/film-stocks', verifyToken, (_req, res) => {
  res.json(FILM_CATALOG);
});

router.get('/film-brands', verifyToken, (_req, res) => {
  res.json(getFilmBrands());
});

router.get('/camera-models/:catalogKey', verifyToken, (req, res) => {
  const entry = CAMERA_CATALOG.find((c) => c.catalogKey === req.params.catalogKey);
  if (!entry) return res.status(404).json({ message: 'Không tìm thấy dòng máy' });
  res.json(entry);
});

router.get('/film-stocks/:catalogKey', verifyToken, (req, res) => {
  const entry = getCatalogEntry(req.params.catalogKey);
  if (!entry) return res.status(404).json({ message: 'Không tìm thấy cuộn film' });
  res.json(entry);
});

/** Resolve + fill từ master data (quét, AI, nhập tay) */
router.post('/resolve-camera', verifyToken, (req, res) => {
  const { catalog_key, brand, model, query } = req.body;
  const resolved = resolveCamera({ catalogKey: catalog_key, brand, model, query });
  if (!resolved) {
    return res.json({ matched: false, detected: fillCameraIntake({ product_group: 'camera', brand, model_name: model }) });
  }
  res.json({
    matched: true,
    confidence: resolved.confidence,
    entry: resolved.entry,
    detected: fillCameraIntake(catalogToIntakePayload(resolved.entry)),
  });
});

router.post('/resolve-film', verifyToken, (req, res) => {
  const { catalog_key, sku, name, brand, format } = req.body;
  const resolved = resolveFilm({ catalogKey: catalog_key, sku, name, brand });
  if (!resolved) {
    return res.json({ matched: false, detected: fillFilmIntake({ product_group: 'film', name, brand }) });
  }
  res.json({
    matched: true,
    confidence: resolved.confidence,
    entry: resolved.entry,
    detected: fillFilmIntake(filmToIntake(resolved.entry, { format })),
  });
});

router.post('/validate-camera-serial', verifyToken, (req, res) => {
  try {
    const { catalog_key, serial_number } = req.body;
    if (!catalog_key) return res.status(400).json({ message: 'Thiếu catalog_key' });
    const result = validateCameraSerial(catalog_key, serial_number);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi kiểm tra sê-ri', error: error.message });
  }
});

router.post('/generate-camera-serial', verifyToken, async (req, res) => {
  try {
    const { catalog_key, year } = req.body;
    if (!catalog_key) return res.status(400).json({ message: 'Thiếu catalog_key' });
    const generated = await generateCounterCode(catalog_key, year);
    res.json(generated);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Lỗi sinh mã quầy' });
  }
});

router.post('/generate-camera-code', verifyToken, async (req, res) => {
  try {
    const { catalog_key, year } = req.body;
    if (!catalog_key) return res.status(400).json({ message: 'Thiếu catalog_key' });
    const generated = await generateCounterCode(catalog_key, year);
    res.json(generated);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Lỗi sinh mã quầy' });
  }
});

router.post('/apply-camera-model', verifyToken, (req, res) => {
  const entry = CAMERA_CATALOG.find((c) => c.catalogKey === req.body.catalog_key);
  if (!entry) return res.status(404).json({ message: 'Không tìm thấy dòng máy' });
  res.json({ detected: fillCameraIntake(catalogToIntakePayload(entry)) });
});

router.post('/apply-film-stock', verifyToken, (req, res) => {
  const entry = getCatalogEntry(req.body.catalog_key);
  if (!entry) return res.status(404).json({ message: 'Không tìm thấy cuộn film' });
  res.json({ detected: fillFilmIntake(filmToIntake(entry, { format: req.body.format })) });
});

router.post('/detect-camera-serial', verifyToken, (req, res) => {
  const entry = findCatalogBySerial(req.body.serial_number);
  if (!entry) {
    return res.json({ matched: false, message: 'Sê-ri không khớp catalog máy film' });
  }
  const validation = validateCameraSerial(entry.catalogKey, req.body.serial_number);
  res.json({
    matched: true,
    catalog_key: entry.catalogKey,
    detected: fillCameraIntake(catalogToIntakePayload(entry)),
    validation,
  });
});

module.exports = router;
