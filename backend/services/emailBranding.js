const fs = require('fs');
const path = require('path');
const { BRAND_NAME, BRAND_TAGLINE, LOGO_CID } = require('../config/brand');

const ASSETS_DIR = path.join(__dirname, '../assets');
const LOGO_PATH = path.join(ASSETS_DIR, 'hdt-labx-logo.png');
const LOGO_EMAIL_PATH = path.join(ASSETS_DIR, 'hdt-labx-logo.png');

let logoBase64Cache = null;

/** Logo email — lockup HDT Labx */
function resolveEmailLogoPath() {
  const candidates = [
    process.env.EMAIL_LOGO_PATH,
    LOGO_PATH,
    LOGO_EMAIL_PATH,
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

const getLogoAttachment = () => {
  const logoPath = resolveEmailLogoPath();
  if (!logoPath) {
    console.warn('⚠️ Không tìm thấy file logo email tại backend/assets/');
    return null;
  }

  return {
    filename: path.basename(logoPath),
    content: fs.readFileSync(logoPath),
    cid: LOGO_CID,
    contentType: 'image/png',
    contentDisposition: 'inline',
  };
};

const getLogoBase64 = () => {
  const logoPath = resolveEmailLogoPath();
  if (!logoPath) return null;
  if (!logoBase64Cache) {
    logoBase64Cache = fs.readFileSync(logoPath).toString('base64');
  }
  return logoBase64Cache;
};

/** src cho &lt;img&gt; — CID khi gửi SMTP, data URI khi preview HTML */
const getLogoImgSrc = ({ preferDataUri = false } = {}) => {
  if (preferDataUri) {
    const b64 = getLogoBase64();
    return b64 ? `data:image/png;base64,${b64}` : null;
  }
  return `cid:${LOGO_CID}`;
};

/** @deprecated Dùng buildEmailLayout — giữ để tương thích */
const buildEmailLogoHeaderHtml = (eyebrow = '') => {
  const { buildEmailLayout } = require('../templates/emailLayout');
  return buildEmailLayout({ eyebrow, introHtml: '', bodyHtml: '' });
};

const buildEmailFooterHtml = () => '';

const brandSubject = (text) => `[${BRAND_NAME}] ${text}`;

module.exports = {
  BRAND_NAME,
  BRAND_TAGLINE,
  LOGO_CID,
  LOGO_PATH,
  LOGO_EMAIL_PATH,
  resolveEmailLogoPath,
  getLogoAttachment,
  getLogoBase64,
  getLogoImgSrc,
  buildEmailLogoHeaderHtml,
  buildEmailFooterHtml,
  brandSubject,
};
