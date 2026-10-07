const NO_FACTORY_SERIAL_PREFIX = 'NOSN-';

export function isNoFactorySerial(row) {
  if (!row) return false;
  if (row.serial_is_generated) return true;
  return String(row.serial_number || '')
    .toUpperCase()
    .startsWith(NO_FACTORY_SERIAL_PREFIX);
}

/** Sê-ri thật để hiển thị; null nếu máy không có sê-ri gốc. */
export function displayCameraSerial(row) {
  if (isNoFactorySerial(row)) return '';
  return String(row?.serial_number || '').trim();
}

function derivePrefixFromModel(entry) {
  const clean = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase();
  const brandRaw = clean(entry.brand);
  const brand = brandRaw.slice(0, 3);
  let modelSrc = clean(entry.modelShort || entry.model);
  if (!entry.modelShort && brandRaw && modelSrc.startsWith(brandRaw)) {
    modelSrc = modelSrc.slice(brandRaw.length);
  }
  const model = modelSrc.slice(0, 3);
  return `${brand}${model}`;
}

export function buildCounterCodeLocal(entry, existingCodes = []) {
  const code =
    entry.internalCodePrefix ||
    String(entry.serialPrefix || '')
      .replace(/-$/, '')
      .replace(/[^A-Z0-9]/gi, '') ||
    derivePrefixFromModel(entry) ||
    'CAM';
  const y = new Date().getFullYear();
  const regex = new RegExp(`^${code}-${y}-(\\d+)$`, 'i');
  let maxSeq = 0;
  for (const raw of existingCodes) {
    const m = String(raw || '').match(regex);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  const seq = String(maxSeq + 1).padStart(3, '0');
  return `${code}-${y}-${seq}`.toUpperCase();
}
