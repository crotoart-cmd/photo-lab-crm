const copy = require('./publicSeoData.json');
const { PRODUCTION_SITE_HOST, isPublicWebHost } = require('../config/hosts');

const ORIGIN = `https://${PRODUCTION_SITE_HOST}`;
const START = '<!-- public-seo:start -->';
const END = '<!-- public-seo:end -->';
const ALIASES = { '/sua-may': '/repair', '/phu-kien': '/shop', '/lien-he': '/contact' };

function publicPageMetadata(pathname = '/', language = 'en') {
  const lang = typeof language === 'string' && Object.hasOwn(copy, language) ? language : 'en';
  const clean = pathname.replace(/\/+$/, '') || '/';
  const path = ALIASES[clean] || clean;
  const key = Object.hasOwn(copy.en, path) ? path : /^\/blog\/[^/]+$/.test(path) ? '/blog' : null;
  if (!key) return null;
  const [title, description] = copy[lang][key];
  const urlFor = (id) => `${ORIGIN}${path}${id === 'en' ? '' : `?lang=${id}`}`;
  return {
    lang, path, title, description, canonical: urlFor(lang),
    alternates: Object.keys(copy).map((id) => ({ lang: id, href: urlFor(id) })),
  };
}

function structuredData(meta) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: 'HDTLabx', url: `${ORIGIN}/`,
        logo: `${ORIGIN}/hdt-labx-logo.svg`,
        description: copy.en['/'][1],
      },
      {
        '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: 'HDTLabx', alternateName: 'HDT Labx',
        url: `${ORIGIN}/`, inLanguage: Object.keys(copy), publisher: { '@id': `${ORIGIN}/#organization` },
      },
      {
        '@type': 'WebPage', '@id': `${meta.canonical}#webpage`, url: meta.canonical,
        name: meta.title, description: meta.description, inLanguage: meta.lang,
        isPartOf: { '@id': `${ORIGIN}/#website` },
      },
    ],
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function metadataHead(meta, privateTitle = 'HDTLabx') {
  if (!meta) return `<title data-public-seo>${privateTitle}</title>\n<meta data-public-seo name="robots" content="noindex, nofollow" />`;
  const attr = escapeHtml;
  const tags = [
    `<title data-public-seo>${attr(meta.title)}</title>`,
    `<meta data-public-seo name="description" content="${attr(meta.description)}" />`,
    `<link data-public-seo rel="canonical" href="${attr(meta.canonical)}" />`,
    ...meta.alternates.map(({ lang, href }) => `<link data-public-seo rel="alternate" hreflang="${lang}" href="${attr(href)}" />`),
    `<link data-public-seo rel="alternate" hreflang="x-default" href="${ORIGIN}${attr(meta.path)}" />`,
    '<meta data-public-seo property="og:site_name" content="HDTLabx" />',
    '<meta data-public-seo property="og:type" content="website" />',
    `<meta data-public-seo property="og:title" content="${attr(meta.title)}" />`,
    `<meta data-public-seo property="og:description" content="${attr(meta.description)}" />`,
    `<meta data-public-seo property="og:url" content="${attr(meta.canonical)}" />`,
    `<script data-public-seo type="application/ld+json">${JSON.stringify(structuredData(meta)).replace(/</g, '\\u003c')}</script>`,
  ];
  return tags.join('\n    ');
}

function renderPublicSeo(html, { hostname, pathname = '/', language = 'en' }) {
  const start = html.indexOf(START);
  const end = html.indexOf(END, start);
  if (start < 0 || end < 0) throw new Error('Missing public SEO template markers');
  const meta = isPublicWebHost(hostname) ? publicPageMetadata(pathname, language) : null;
  const head = `${html.slice(0, start + START.length)}\n    ${metadataHead(meta, isPublicWebHost(hostname) ? 'HDTLabx' : 'HDTLabx Admin')}\n    ${html.slice(end)}`;
  return head.replace(/<html lang="(?:en|vi|de|es)">/, `<html lang="${meta?.lang || 'en'}">`);
}

module.exports = { publicPageMetadata, structuredData, metadataHead, renderPublicSeo };
