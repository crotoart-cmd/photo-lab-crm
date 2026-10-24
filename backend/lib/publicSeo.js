const { PRODUCTION_SITE_HOST, PRODUCTION_ADMIN_HOST, isPublicWebHost } = require('../config/hosts');

function canonicalPublicOrigin() {
  const fromEnv = String(process.env.SITE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) {
    try {
      const url = new URL(fromEnv);
      if (url.protocol === 'https:' && url.hostname === PRODUCTION_SITE_HOST && !url.port && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return url.origin;
    } catch {}
  }
  return `https://${PRODUCTION_SITE_HOST}`;
}

const PUBLIC_PAGE_PATHS = [
  '/',
  '/film',
  '/toc-do',
  '/in-analog',
  '/scan',
  '/repair',
  '/shop',
  '/contact',
  '/blog',
  '/faq',
  '/about',
];

const PUBLIC_PATH_PREFIXES = [
  '/film',
  '/toc-do',
  '/in-analog',
  '/scan',
  '/sua-may',
  '/phu-kien',
  '/blog',
  '/lien-he',
  '/faq',
  '/about',
  '/delivery',
  '/repair',
  '/shop',
  '/contact',
  '/assets/',
  '/media/',
  '/fonts/',
  '/uploads/',
  '/api/',
];

const PUBLIC_EXACT_FILES = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-32x32.png',
  '/favicon-96x96.png',
  '/apple-touch-icon.png',
  '/iphone.html',
  '/hdt-labx-logo.svg',
  '/hdt-labx-logo.png',
]);

const TOKEN_RE = /^[A-Za-z0-9_-]{10,100}$/;

function googleSiteVerificationToken() {
  return String(process.env.GOOGLE_SITE_VERIFICATION || '').trim();
}

function isValidVerificationToken(token) {
  return TOKEN_RE.test(token);
}

function googleVerificationFileName(token = googleSiteVerificationToken()) {
  const fromEnv = String(process.env.GOOGLE_SITE_VERIFICATION_FILE || '').trim();
  if (/^google[A-Za-z0-9_-]+\.html$/i.test(fromEnv)) return fromEnv.toLowerCase();
  if (isValidVerificationToken(token)) return `google${token}.html`.toLowerCase();
  return '';
}

function stayOnPublicHost(pathname) {
  const p = String(pathname || '/').split('?')[0];
  if (p === '/' || p === '') return true;
  if (PUBLIC_EXACT_FILES.has(p)) return true;
  if (p.startsWith('/.well-known/')) return true;
  if (/^\/google[A-Za-z0-9_-]+\.html$/i.test(p)) return true;
  if (PUBLIC_PATH_PREFIXES.some((prefix) => {
    const root = prefix.replace(/\/$/, '');
    return p === root || p.startsWith(`${root}/`);
  })) {
    return true;
  }
  if (/\.(png|jpe?g|svg|webp|gif|ico|woff2?|ttf|otf|css|js|map|webmanifest)$/i.test(p)) return true;
  return false;
}

function robotsTxtForHost(isPublicHost) {
  if (!isPublicHost) {
    return 'User-agent: *\nDisallow: /\n';
  }
  const origin = canonicalPublicOrigin();
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

function sitemapXml() {
  const origin = canonicalPublicOrigin();
  const urls = PUBLIC_PAGE_PATHS.map(
    (loc) => `  <url>\n    <loc>${origin}${loc === '/' ? '/' : loc}</loc>\n    <changefreq>weekly</changefreq>\n  </url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function googleHtmlBody(token = googleSiteVerificationToken()) {
  const filename = googleVerificationFileName(token);
  if (!filename) return '';
  return `google-site-verification: ${filename}\n`;
}

function injectGoogleSiteVerification(html) {
  const token = googleSiteVerificationToken();
  if (!isValidVerificationToken(token)) return html;
  if (/name=["']google-site-verification["']/i.test(html)) return html;
  return String(html).replace(
    /<head([^>]*)>/i,
    `<head$1>\n    <meta name="google-site-verification" content="${token}" />`
  );
}

function mountPublicSeo(app) {
  app.use((req, res, next) => {
    if (req.hostname !== `www.${PRODUCTION_SITE_HOST}` || !['GET', 'HEAD'].includes(req.method) || req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    const target = req.originalUrl.startsWith('/') && !req.originalUrl.startsWith('//') ? req.originalUrl : '/';
    return res.redirect(308, `https://${PRODUCTION_SITE_HOST}${target}`);
  });

  app.use((req, res, next) => {
    const privateLink = req.path === '/delivery' || req.path.startsWith('/delivery/') || req.path === '/repair/confirm' || req.path.startsWith('/repair/confirm/');
    if (req.hostname === PRODUCTION_ADMIN_HOST || privateLink) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return next();
  });

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(robotsTxtForHost(isPublicWebHost(req.hostname) || req.hostname === PRODUCTION_SITE_HOST));
  });

  app.get('/sitemap.xml', (req, res) => {
    if (!isPublicWebHost(req.hostname)) {
      res.type('text/plain; charset=utf-8');
      return res.status(404).send('Not found');
    }
    res.type('application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(sitemapXml());
  });

  app.get(/^\/google[A-Za-z0-9_-]+\.html$/i, (req, res, next) => {
    if (!isPublicWebHost(req.hostname)) return res.status(404).type('text/plain').send('Not found');
    const token = googleSiteVerificationToken();
    const expected = googleVerificationFileName(token);
    const requested = String(req.path || '').replace(/^\//, '').toLowerCase();
    if (!expected) return next();
    if (requested !== expected) {
      return res.status(404).type('text/plain').send('Not found');
    }
    res.type('text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(googleHtmlBody(token));
  });
}

module.exports = {
  PUBLIC_PAGE_PATHS,
  stayOnPublicHost,
  robotsTxtForHost,
  sitemapXml,
  googleHtmlBody,
  googleVerificationFileName,
  injectGoogleSiteVerification,
  googleSiteVerificationToken,
  isValidVerificationToken,
  canonicalPublicOrigin,
  mountPublicSeo,
};
