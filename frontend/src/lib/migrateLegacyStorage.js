/**
 * Một lần: chuyển key localStorage từ tiền tố NuocLeo → HDTLabx.
 * Giữ dữ liệu offline/mobile khi đổi brand kỹ thuật.
 */
const FLAG = 'hdtlabx_storage_migrated_v1';

const EXACT_KEYS = [
  'nuocleo_api_base',
  'nuocleo_offline_mode',
  'nuocleo_offline_cred',
  'nuocleo_server_jwt',
  'nuocleo_dashboard_cache',
  'nuocleo_customers_enriched',
  'nuocleo_customers_care',
  'nuocleo_customer_id_map',
  'nuocleo_inventory_id_map',
  'nuocleo_repair_id_map',
  'nuocleo_film_lab_id_map',
  'nuocleo_local_summary_cache',
  'nuocleo_local_sync_queue',
  'nuocleo_local_film_stock',
  'nuocleo_local_battery_stock',
  'nuocleo_local_camera_stock',
  'nuocleo_local_sales',
  'nuocleo_local_customer_repairs',
  'nuocleo_local_lab_films',
  'nuocleo_local_inventory',
  'nuocleo_local_inventory_logs',
  'nuocleo_storage_settings',
  'nuocleo_backup_settings',
  'nuocleo_backup_meta',
  'nuocleo.dashboard.displayMeta',
];

function renameKey(oldKey) {
  if (oldKey.startsWith('nuocleo_')) return `hdtlabx_${oldKey.slice('nuocleo_'.length)}`;
  if (oldKey.startsWith('nuocleo.')) return `hdtlabx.${oldKey.slice('nuocleo.'.length)}`;
  if (oldKey.startsWith('nuocleo-')) return `hdtlabx-${oldKey.slice('nuocleo-'.length)}`;
  return null;
}

export function migrateLegacyStorageKeys() {
  if (typeof window === 'undefined' || !window.localStorage) return { migrated: 0, skipped: true };
  try {
    if (localStorage.getItem(FLAG) === '1') return { migrated: 0, already: true };
  } catch {
    return { migrated: 0, skipped: true };
  }

  let migrated = 0;
  const seen = new Set();

  const move = (oldKey) => {
    if (!oldKey || seen.has(oldKey)) return;
    seen.add(oldKey);
    const newKey = renameKey(oldKey);
    if (!newKey || newKey === oldKey) return;
    try {
      const val = localStorage.getItem(oldKey);
      if (val == null) return;
      if (localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, val);
      }
      localStorage.removeItem(oldKey);
      migrated += 1;
    } catch {
      /* ignore quota / private mode */
    }
  };

  for (const key of EXACT_KEYS) move(key);

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('nuocleo_') || key.startsWith('nuocleo.') || key.startsWith('nuocleo-'))) {
        move(key);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    localStorage.setItem(FLAG, '1');
  } catch {
    /* ignore */
  }

  return { migrated };
}
