const CameraStock = require('../models/CameraStock');
const CAMERA_CATALOG = require('../data/cameraModelCatalog');

const normalizeSerial = (s) =>
  String(s || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

const getCatalogEntry = (catalogKey) =>
  CAMERA_CATALOG.find((c) => c.catalogKey === catalogKey) || null;

const parseSerialNumeric = (serial, prefix) => {
  const s = normalizeSerial(serial);
  const p = String(prefix).toUpperCase();
  if (!s.startsWith(p)) return null;
  const tail = s.slice(p.length).replace(/[^0-9]/g, '');
  if (!tail) return null;
  const num = parseInt(tail, 10);
  return Number.isFinite(num) ? num : null;
};

const estimateYear = (entry, serialNum) => {
  if (serialNum == null || entry.serialMax <= entry.serialMin) return null;
  const ratio = (serialNum - entry.serialMin) / (entry.serialMax - entry.serialMin);
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round(entry.yearMin + clamped * (entry.yearMax - entry.yearMin));
};

function findCatalogBySerial(serial) {
  const s = normalizeSerial(serial);
  for (const entry of CAMERA_CATALOG) {
    if (entry.serialValidation !== 'strict') continue;
    const prefix = entry.serialPrefix.toUpperCase();
    if (s.startsWith(prefix)) return entry;
  }
  return null;
}

function validateCameraSerial(catalogKey, serial) {
  const entry = getCatalogEntry(catalogKey);
  if (!entry) {
    return { valid: false, message: 'Không tìm thấy dòng máy trong catalog' };
  }

  const normalized = normalizeSerial(serial);
  if (!normalized) {
    return { valid: false, message: 'Chưa nhập số sê-ri' };
  }

  if (entry.serialValidation !== 'strict') {
    return {
      valid: true,
      inRange: true,
      normalizedSerial: normalized,
      message: 'Sê-ri đã ghi nhận',
      catalog: entry,
    };
  }

  const prefix = entry.serialPrefix.toUpperCase();
  if (!normalized.startsWith(prefix)) {
    return {
      valid: false,
      normalizedSerial: normalized,
      expectedPattern: entry.serialPattern,
      message: `Sê-ri phải theo dạng ${entry.serialPattern} (tiền tố ${prefix})`,
    };
  }

  const serialNum = parseSerialNumeric(normalized, prefix);
  if (serialNum == null) {
    return {
      valid: false,
      normalizedSerial: normalized,
      message: 'Không đọc được phần số trong sê-ri',
    };
  }

  const inRange = serialNum >= entry.serialMin && serialNum <= entry.serialMax;
  const estimatedYear = estimateYear(entry, serialNum);

  if (!inRange) {
    return {
      valid: false,
      inRange: false,
      normalizedSerial: normalized,
      serialNumber: serialNum,
      range: { min: entry.serialMin, max: entry.serialMax, prefix },
      estimatedYear,
      message: `Sê-ri ${normalized} ngoài khoảng tham chiếu ${prefix}${entry.serialMin} → ${prefix}${entry.serialMax}`,
      catalog: entry,
    };
  }

  return {
    valid: true,
    inRange: true,
    normalizedSerial: normalized,
    serialNumber: serialNum,
    estimatedYear,
    message: `Sê-ri hợp lệ — ước tính năm SX ~${estimatedYear}`,
    catalog: entry,
  };
}

const counterCodePrefix = (entry) =>
  entry.internalCodePrefix ||
  entry.serialPrefix.replace(/-$/, '').replace(/[^A-Z0-9]/gi, '');

/** Mã quầy nội bộ khi máy không có sê-ri khắc trên thân (vd. AE1-2026-001). */
async function generateCounterCode(catalogKey, year) {
  const entry = getCatalogEntry(catalogKey);
  if (!entry) throw new Error('Không tìm thấy dòng máy trong catalog');

  const code = counterCodePrefix(entry);
  const y = Number(year) || new Date().getFullYear();
  const regex = new RegExp(`^${code}-${y}-(\\d+)$`, 'i');

  const existing = await CameraStock.find({ catalog_key: catalogKey }).select(
    'camera_code serial_number',
  );

  let maxSeq = 0;
  for (const row of existing) {
    for (const field of [row.camera_code, row.serial_number]) {
      const m = String(field || '').match(regex);
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }
  }

  const seq = String(maxSeq + 1).padStart(3, '0');
  const camera_code = `${code}-${y}-${seq}`.toUpperCase();

  return {
    camera_code,
    serial_is_generated: true,
    catalog_key: catalogKey,
    brand: entry.brand,
    model: entry.model,
    camera_type: entry.cameraType,
    note: `Mã quầy nội bộ — máy không có sê-ri gốc (${entry.model})`,
  };
}

/** @deprecated Dùng generateCounterCode — giữ alias cho client cũ */
async function generateInternalSerial(catalogKey, year) {
  return generateCounterCode(catalogKey, year);
}

const NO_FACTORY_SERIAL_PREFIX = 'NOSN-';

function placeholderSerialForCode(cameraCode) {
  return `${NO_FACTORY_SERIAL_PREFIX}${String(cameraCode || '').toUpperCase()}`;
}

function isPlaceholderSerial(serial) {
  return String(serial || '')
    .toUpperCase()
    .startsWith(NO_FACTORY_SERIAL_PREFIX);
}

function resolveStoredSerial({ serial_number, camera_code, serial_is_generated }) {
  const serial = normalizeSerial(serial_number);
  if (serial && !isPlaceholderSerial(serial)) return serial;
  if (serial_is_generated || !serial) {
    if (!camera_code) throw new Error('Cần mã quầy khi máy không có sê-ri');
    return placeholderSerialForCode(camera_code);
  }
  return serial;
}

function catalogToIntakePayload(entry) {
  const serialRange =
    entry.serialValidation === 'strict'
      ? `${entry.serialPrefix}${entry.serialMin} → ${entry.serialPrefix}${entry.serialMax}`
      : null;
  const noteParts = [
    entry.notes,
    entry.serialValidation === 'strict' ? `Pattern: ${entry.serialPattern}` : null,
  ].filter(Boolean);
  return {
    product_group: 'camera',
    source: 'catalog',
    catalog_key: entry.catalogKey,
    brand: entry.brand,
    model_name: entry.model,
    name: entry.model,
    camera_type: entry.cameraType,
    brand_group: entry.brand.toUpperCase().replace(/\s+/g, ''),
    category_cluster: `CAMERA ${entry.cameraType}`,
    note: noteParts.join(' · '),
    serialPattern: entry.serialValidation === 'strict' ? entry.serialPattern : undefined,
    serialRange,
  };
}

module.exports = {
  CAMERA_CATALOG,
  getCatalogEntry,
  findCatalogBySerial,
  validateCameraSerial,
  generateCounterCode,
  generateInternalSerial,
  catalogToIntakePayload,
  normalizeSerial,
  placeholderSerialForCode,
  isPlaceholderSerial,
  resolveStoredSerial,
  NO_FACTORY_SERIAL_PREFIX,
};
