const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { getDeliveryDir } = require('./deliveryFolderService');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

const mimeFromFilename = (name) => {
  const ext = path.extname(name || '').toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.pdf': 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
};

const resolveCredentialsPath = () => {
  const configured = process.env.GOOGLE_DRIVE_CREDENTIALS_PATH;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(__dirname, '..', configured);
  }
  return path.join(__dirname, '../credentials.json');
};

const isGoogleDriveConfigured = () => {
  const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  if (!parentId) return false;
  const keyPath = resolveCredentialsPath();
  return fs.existsSync(keyPath);
};

let driveClient = null;

const getDriveClient = async () => {
  if (driveClient) return driveClient;
  const keyPath = resolveCredentialsPath();
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      'Chưa có credentials.json — tải key Service Account từ Google Cloud và đặt vào backend/'
    );
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: [DRIVE_SCOPE],
  });
  driveClient = google.drive({ version: 'v3', auth: await auth.getClient() });
  return driveClient;
};

const makeFolderPublic = async (drive, folderId) => {
  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch (err) {
    if (err?.code !== 409) throw err;
  }
};

const folderLabel = (film) =>
  String(film.ticketNumber || film.filmCode || film.deliverySlug || 'SCAN').replace(
    /[^\w.-]+/g,
    '_'
  );

/**
 * Upload local delivery folder to Google Drive (subfolder under Lab_Scan_Photos).
 * @returns {{ folderId: string, webViewLink: string, uploadedCount: number }}
 */
const uploadFilmDeliveryToDrive = async (film, { forceNewFolder = false } = {}) => {
  const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  if (!parentId) {
    throw new Error('Thiếu GOOGLE_DRIVE_PARENT_FOLDER_ID trong .env');
  }

  const files = film.deliveryFiles || [];
  if (!files.length) {
    throw new Error('Folder chưa có file ảnh');
  }

  const localDir = getDeliveryDir(film.deliverySlug);
  const drive = await getDriveClient();

  let folderId = !forceNewFolder ? film.driveFolderId : null;

  if (!folderId) {
    const name = forceNewFolder
      ? `${folderLabel(film)}-${Date.now()}`
      : folderLabel(film);
    const folderRes = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });
    folderId = folderRes.data.id;
  } else if (!forceNewFolder && film.driveSyncedAt) {
    const syncedAt = new Date(film.driveSyncedAt).getTime();
    const hasNewFiles = files.some((f) => new Date(f.uploadedAt).getTime() > syncedAt);
    if (!hasNewFiles) {
      await makeFolderPublic(drive, folderId);
      const linkRes = await drive.files.get({
        fileId: folderId,
        fields: 'webViewLink',
      });
      return {
        folderId,
        webViewLink: linkRes.data.webViewLink,
        uploadedCount: 0,
        reusedExisting: true,
      };
    }
  }

  let uploadedCount = 0;
  for (const meta of files) {
    const filePath = path.join(localDir, meta.filename);
    if (!fs.existsSync(filePath)) continue;

    const displayName = meta.originalName || meta.filename;
    await drive.files.create({
      requestBody: {
        name: displayName,
        parents: [folderId],
      },
      media: {
        mimeType: meta.mimeType || mimeFromFilename(displayName),
        body: fs.createReadStream(filePath),
      },
    });
    uploadedCount += 1;
  }

  if (uploadedCount === 0) {
    throw new Error('Không tìm thấy file ảnh trên đĩa — hãy tải lại ảnh vào folder');
  }

  await makeFolderPublic(drive, folderId);

  const linkRes = await drive.files.get({
    fileId: folderId,
    fields: 'webViewLink',
  });

  return {
    folderId,
    webViewLink: linkRes.data.webViewLink,
    uploadedCount,
  };
};

const getDriveStatus = () => {
  const keyPath = resolveCredentialsPath();
  let serviceAccountEmail = null;
  try {
    if (fs.existsSync(keyPath)) {
      const raw = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      serviceAccountEmail = raw.client_email || null;
    }
  } catch {
    /* ignore */
  }
  return {
    configured: isGoogleDriveConfigured(),
    parentFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || null,
    credentialsPath: keyPath,
    credentialsFound: fs.existsSync(keyPath),
    serviceAccountEmail,
    required: process.env.GOOGLE_DRIVE_REQUIRED === 'true',
  };
};

module.exports = {
  isGoogleDriveConfigured,
  uploadFilmDeliveryToDrive,
  getDriveStatus,
  resolveCredentialsPath,
};
