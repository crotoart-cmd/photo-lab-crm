const PRODUCTION_SITE_HOST = 'hdtlabx.com';
const PRODUCTION_ADMIN_HOST = 'admin.hdtlabx.com';

function hostnameOf(host) {
  return String(host || '')
    .split(':')[0]
    .toLowerCase()
    .replace(/\.$/, '');
}

function isPublicWebHost(host) {
  const h = hostnameOf(host);
  return h === PRODUCTION_SITE_HOST || h === `www.${PRODUCTION_SITE_HOST}`;
}

function getAdminSiteUrl() {
  const fromEnv = String(process.env.ADMIN_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') return `https://${PRODUCTION_ADMIN_HOST}`;
  return 'http://localhost:3000';
}

module.exports = {
  PRODUCTION_SITE_HOST,
  PRODUCTION_ADMIN_HOST,
  isPublicWebHost,
  getAdminSiteUrl,
};
