import testCameras from '../data/test-cameras.json';
import { loadCameraStock, saveCameraStock, newLocalId } from './mobileLocalDb';

function upper(s) {
  return String(s || '').trim().toUpperCase();
}

/** Nạp 10 máy ảnh test vào tồn kho local trên iPhone. */
export function seedLocalTestCameras() {
  const existing = loadCameraStock();
  const testSerials = new Set(testCameras.map((c) => upper(c.serial_number)));
  const kept = existing.filter((c) => !testSerials.has(upper(c.serial_number)));
  const now = new Date().toISOString();

  const rows = [
    ...kept,
    ...testCameras.map((c) => ({
      _id: newLocalId(),
      camera_code: upper(c.camera_code),
      serial_number: upper(c.serial_number),
      barcode: upper(c.barcode || c.serial_number),
      model_name: c.model_name,
      name: c.model_name,
      brand: c.brand,
      camera_type: c.camera_type,
      condition_note: c.condition_note,
      status: 'San_Hang',
      cost: c.cost,
      price: c.price,
      floor_price: c.floor_price,
      updatedAt: now,
      _local: true,
    })),
  ];

  saveCameraStock(rows);
  const added = rows.length - kept.length;
  return { added, total: rows.length, ready: rows.filter((r) => r.status === 'San_Hang').length };
}

export function countLocalTestCameras() {
  const testSerials = new Set(testCameras.map((c) => upper(c.serial_number)));
  return loadCameraStock().filter((c) => testSerials.has(upper(c.serial_number))).length;
}

/** Tự nạp 10 máy test nếu chưa có máy sẵn bán trên iPhone. */
export function ensureLocalTestCameras() {
  const ready = loadCameraStock().filter((c) => c.status === 'San_Hang').length;
  if (ready > 0) return { seeded: false, ready };
  return { seeded: true, ...seedLocalTestCameras() };
}

export const RETAIL_DATA_CHANGED = 'nuocleo-retail-data-changed';

export function notifyRetailDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RETAIL_DATA_CHANGED));
  }
}
