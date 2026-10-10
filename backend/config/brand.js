const PRODUCTION_SITE_URL = 'https://hdtlabx.com';
const PRODUCTION_ADMIN_URL = 'https://admin.hdtlabx.com';

function getFrontendUrl() {
  const fromEnv = String(process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') return PRODUCTION_SITE_URL;
  return 'http://localhost:3000';
}

module.exports = {
  BRAND_NAME: process.env.BRAND_NAME || 'HDTLabx',
  STORE_NAME: process.env.STORE_NAME || process.env.BRAND_NAME || 'HDTLabx',
  BRAND_TAGLINE: process.env.BRAND_TAGLINE || 'Preserve Memories, Live Every Second',
  LOGO_CID: 'nuocleo-logo',
  PRODUCTION_SITE_URL,
  PRODUCTION_ADMIN_URL,
  getFrontendUrl,
};
