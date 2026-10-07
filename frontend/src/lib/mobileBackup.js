import {
  buildLocalBackupPayload,
  getBackupMeta,
  getBackupSettings,
  isMobileDataEnabled,
  markBackupSynced,
} from './mobileLocalDb';
import { backupApi, hasBackupSession } from './mobileServerLink';

function hoursAgo(hours) {
  return Date.now() - hours * 60 * 60 * 1000;
}

export function shouldRunAutoBackup() {
  if (!isMobileDataEnabled()) return false;
  if (!hasBackupSession()) return false;
  const settings = getBackupSettings();
  if (!settings.autoBackupEnabled) return false;

  const meta = getBackupMeta();
  const last = new Date(meta.serverBackupAt || 0).getTime();
  if (!Number.isFinite(last) || last <= 0) return true;
  return last < hoursAgo(settings.autoBackupHours);
}

export async function backupToServer(reason = 'manual') {
  if (!isMobileDataEnabled()) return { skipped: true, reason: 'disabled' };
  if (!hasBackupSession()) return { skipped: true, reason: 'no-backup-session' };

  const payload = buildLocalBackupPayload();
  const res = await backupApi({ method: 'post', url: '/backup/mobile', data: { reason, payload } });
  if (!res) return { skipped: true, reason: 'server-unreachable' };
  markBackupSynced({ reason, id: res.data?.backup?.id });
  return res.data;
}
