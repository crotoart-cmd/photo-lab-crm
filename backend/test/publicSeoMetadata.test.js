const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { publicPageMetadata, structuredData, renderPublicSeo } = require('../lib/publicSeoMetadata');
const copy = require('../lib/publicSeoData.json');

const template = fs.readFileSync(path.join(__dirname, '../../frontend/index.html'), 'utf8');

test('all eleven public pages have four translated, page-specific descriptions', () => {
  for (const lang of ['en', 'vi', 'de', 'es']) {
    assert.equal(Object.keys(copy[lang]).length, 11);
    for (const pathname of Object.keys(copy.en)) {
      const meta = publicPageMetadata(pathname, lang);
      assert.equal(meta.lang, lang);
      assert.ok(meta.title.includes('HDTLabx'));
      assert.ok(meta.description.length > 60);
      assert.equal(meta.alternates.length, 4);
      assert.doesNotMatch(meta.description, /login|password|đăng nhập/i);
      const url = new URL(meta.canonical);
      assert.equal(url.hostname, 'hdtlabx.com');
      assert.equal(url.searchParams.get('lang'), lang === 'en' ? null : lang);
    }
  }
});

test('English is the stable default, independent of user agent or IP', () => {
  for (const language of [undefined, 'fr', ['vi'], { toString: 'bad' }, '__proto__', '<script>']) {
    assert.equal(publicPageMetadata('/', language).lang, 'en');
  }
  assert.equal(publicPageMetadata('/').title, 'HDTLabx | Film Lab, Scanning & Camera Repair');
});

test('server HTML includes the localized head before JavaScript runs', () => {
  for (const language of Object.keys(copy)) {
    const html = renderPublicSeo(template, { hostname: 'hdtlabx.com', pathname: '/repair', language });
    assert.ok(html.includes(`<html lang="${language}">`));
    assert.ok(html.includes(`content="${copy[language]['/repair'][1]}"`));
    assert.equal((html.match(/<title\b/g) || []).length, 1);
    assert.equal((html.match(/name="description"/g) || []).length, 1);
    assert.equal((html.match(/hreflang=/g) || []).length, 5);
    assert.ok(html.includes('hreflang="x-default" href="https://hdtlabx.com/repair"'));
    assert.doesNotMatch(html, /content="noindex/);
  }
});

test('admin and private links never inherit public canonical or structured data', () => {
  for (const request of [
    { hostname: 'admin.hdtlabx.com', pathname: '/' },
    { hostname: 'admin.hdtlabx.com', pathname: '/login' },
    { hostname: 'hdtlabx.com', pathname: '/delivery/private-token' },
    { hostname: 'hdtlabx.com', pathname: '/repair/confirm/private-token' },
  ]) {
    const html = renderPublicSeo(template, request);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(html, /rel="canonical"|hreflang=|application\/ld\+json/);
  }
});

test('structured data describes only the real brand, services and original logo', () => {
  const data = structuredData(publicPageMetadata('/'));
  assert.deepEqual(data['@graph'].map((item) => item['@type']), ['Organization', 'WebSite', 'WebPage']);
  const org = data['@graph'][0];
  assert.equal(org.name, 'HDTLabx');
  assert.equal(org.logo, 'https://hdtlabx.com/hdt-labx-logo.svg');
  assert.match(org.description, /camera repair/);
  assert.equal(org.address, undefined);
  assert.equal(org.aggregateRating, undefined);
});

test('metadata safely handles blog paths, aliases, trailing slashes and HTML characters', () => {
  assert.equal(publicPageMetadata('/sua-may/', 'vi').canonical, 'https://hdtlabx.com/repair?lang=vi');
  assert.equal(publicPageMetadata('/blog/after-the-scans', 'de').canonical, 'https://hdtlabx.com/blog/after-the-scans?lang=de');
  assert.equal(publicPageMetadata('/login'), null);
  const html = renderPublicSeo(template, { hostname: 'hdtlabx.com', pathname: '/blog/\"><script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>alert/);
  const first = renderPublicSeo(template, { hostname: 'hdtlabx.com', pathname: '/', language: 'vi' });
  const second = renderPublicSeo(first, { hostname: 'hdtlabx.com', pathname: '/', language: 'en' });
  assert.match(second, /<html lang="en">/);
  assert.equal((second.match(/<title\b/g) || []).length, 1);
});
