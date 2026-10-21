export const MIB = 1024 * 1024;
export const REPAIR_MEDIA_LIMITS = Object.freeze({ files: 6, videos: 2, image: 10 * MIB, video: 50 * MIB, total: 100 * MIB });

const TYPES = {
  jpg: ['image', 'image/jpeg', 'image/jpg'],
  jpeg: ['image', 'image/jpeg', 'image/jpg'],
  png: ['image', 'image/png'],
  webp: ['image', 'image/webp'],
  heic: ['image', 'image/heic', 'image/heic-sequence'],
  heif: ['image', 'image/heif', 'image/heif-sequence'],
  mp4: ['video', 'video/mp4'],
  mov: ['video', 'video/quicktime'],
  webm: ['video', 'video/webm'],
};

export const REPAIR_MEDIA_ACCEPT = Object.keys(TYPES).map((extension) => `.${extension}`).join(',');

// This checks browser metadata for selection UX. The server validates file contents independently.
export function repairMediaKind(file) {
  const extension = String(file?.name || '').split('.').pop().toLowerCase();
  const type = TYPES[extension];
  if (!type) return null;
  const mime = String(file?.type || '').toLowerCase();
  return !mime || mime === 'application/octet-stream' || type.slice(1).includes(mime) ? type[0] : null;
}

export function repairMediaIssue(files) {
  if (files.length > REPAIR_MEDIA_LIMITS.files) return 'files';
  let videos = 0;
  let total = 0;
  for (const file of files) {
    const kind = repairMediaKind(file);
    if (!kind) return 'type';
    if (!Number.isFinite(file.size) || file.size <= 0) return 'empty';
    if (file.size > REPAIR_MEDIA_LIMITS[kind]) return kind;
    if (kind === 'video') videos += 1;
    total += file.size;
  }
  if (videos > REPAIR_MEDIA_LIMITS.videos) return 'videos';
  if (total > REPAIR_MEDIA_LIMITS.total) return 'total';
  return null;
}

export function addRepairMedia(current, incoming) {
  const files = [...current];
  const errors = [];
  for (const file of incoming) {
    const code = repairMediaIssue([...files, file]);
    if (code) errors.push({ name: file.name, code });
    else files.push(file);
  }
  return { files, errors };
}

export function buildRepairSubmission(fields, files, acknowledged) {
  const issue = repairMediaIssue(files);
  if (issue) throw new Error(issue);
  if (!files.length) return { ...fields };
  if (!acknowledged) throw new Error('acknowledgment');
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => body.append(key, value == null ? '' : String(value)));
  files.forEach((file) => body.append('media', file, file.name));
  body.append('media_acknowledged', 'true');
  return body;
}

export function repairUploadProgress(event) {
  const total = Number(event.total);
  const loaded = Number(event.loaded);
  return Number.isFinite(total) && total > 0 && Number.isFinite(loaded) ? Math.min(100, Math.max(0, Math.round((loaded / total) * 100))) : null;
}

export function formatRepairMediaSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  return bytes >= MIB ? `${(bytes / MIB).toFixed(1)} MiB` : `${Math.ceil(bytes / 1024)} KiB`;
}
