const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const {
  stayOnPublicHost,
  robotsTxtForHost,
  sitemapXml,
  injectGoogleSiteVerification,
  googleHtmlBody,
  googleVerificationFileName,
  mountPublicSeo,
  canonicalPublicOrigin,
} = require('../lib/publicSeo');

function withServer(app, fn) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      Promise.resolve(fn(port))
        .then((value) => {
          server.close(() => resolve(value));
        })
        .catch((err) => {
          server.close(() => reject(err));
        });
    });
  });
}

function get(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path, headers }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      })
      .on('error', reject);
  });
}

describe('stayOnPublicHost', () => {
  it('keeps public pages, SEO files and static assets on the customer host', () => {
    assert.equal(stayOnPublicHost('/'), true);
    assert.equal(stayOnPublicHost('/film'), true);
    assert.equal(stayOnPublicHost('/in-analog'), true);
    assert.equal(stayOnPublicHost('/scan'), true);
    assert.equal(stayOnPublicHost('/about'), true);
    assert.equal(stayOnPublicHost('/robots.txt'), true);
    assert.equal(stayOnPublicHost('/sitemap.xml'), true);
    assert.equal(stayOnPublicHost('/favicon.svg'), true);
    assert.equal(stayOnPublicHost('/favicon-32x32.png'), true);
    assert.equal(stayOnPublicHost('/apple-touch-icon.png'), true);
    assert.equal(stayOnPublicHost('/googleabc123def456.html'), true);
    assert.equal(stayOnPublicHost('/assets/index.js'), true);
    assert.equal(stayOnPublicHost('/media/lab/home-hero.jpg'), true);
  });

  it('sends CRM routes to admin', () => {
    assert.equal(stayOnPublicHost('/login'), false);
    assert.equal(stayOnPublicHost('/customers'), false);
    assert.equal(stayOnPublicHost('/dashboard'), false);
    assert.equal(stayOnPublicHost('/film-private'), false);
    assert.equal(stayOnPublicHost('/.env'), false);
  });
});

describe('robots and sitemap', () => {
  it('allows crawling on the public host and points at the sitemap', () => {
    const txt = robotsTxtForHost(true);
    assert.match(txt, /Allow: \//);
    assert.match(txt, /Disallow: \/api\//);
    assert.match(txt, /Sitemap: https:\/\/hdtlabx\.com\/sitemap\.xml/);
  });

  it('blocks indexing on the CRM host', () => {
    assert.equal(robotsTxtForHost(false), 'User-agent: *\nDisallow: /\n');
  });

  it('lists canonical public pages only', () => {
    const xml = sitemapXml();
    assert.match(xml, /https:\/\/hdtlabx\.com\/film/);
    assert.match(xml, /https:\/\/hdtlabx\.com\/in-analog/);
    assert.match(xml, /https:\/\/hdtlabx\.com\/scan/);
    assert.doesNotMatch(xml, /admin\.hdtlabx/);
    assert.doesNotMatch(xml, /\/login/);
    assert.doesNotMatch(xml, /\/delivery|\/api\/|\/uploads\//);
  });

  it('does not emit arbitrary or malformed canonical origins from configuration', () => {
    const previous = process.env.SITE_URL;
    try {
      for (const value of ['https://evil.example/?x=<script>', 'https://hdtlabx.com/film', 'http://hdtlabx.com', 'invalid']) {
        process.env.SITE_URL = value;
        assert.equal(canonicalPublicOrigin(), 'https://hdtlabx.com');
      }
      process.env.SITE_URL = 'https://hdtlabx.com/';
      assert.equal(canonicalPublicOrigin(), 'https://hdtlabx.com');
    } finally {
      if (previous === undefined) delete process.env.SITE_URL;
      else process.env.SITE_URL = previous;
    }
  });

  it('serves plain-text robots and XML directly on the public domain without redirects', async () => {
    const app = express();
    mountPublicSeo(app);
    await withServer(app, async (port) => {
      for (const host of ['hdtlabx.com']) {
        const robots = await get(port, '/robots.txt', { Host: host });
        assert.equal(robots.status, 200);
        assert.match(robots.headers['content-type'], /^text\/plain/);
        assert.equal(robots.headers.location, undefined);
        assert.equal(robots.headers['x-robots-tag'], undefined);
        const sitemap = await get(port, '/sitemap.xml', { Host: host });
        assert.equal(sitemap.status, 200);
        assert.match(sitemap.headers['content-type'], /^application\/xml/);
        assert.equal(sitemap.headers.location, undefined);
        assert.equal(sitemap.body.match(/<url>/g).length, 11);
        assert.match(sitemap.body, /https:\/\/hdtlabx\.com\/about/);
        assert.doesNotMatch(sitemap.body, /admin\.hdtlabx/);
      }
    });
  });

  it('permanently consolidates www pages while preserving paths and language queries', async () => {
    const app = express();
    mountPublicSeo(app);
    app.all('*', (_req, res) => res.send('ok'));
    await withServer(app, async (port) => {
      for (const path of ['/', '/repair?lang=vi&utm_source=test', '/sitemap.xml']) {
        const response = await get(port, path, { Host: 'www.hdtlabx.com' });
        assert.equal(response.status, 308);
        assert.equal(response.headers.location, `https://hdtlabx.com${path}`);
      }
      for (const path of ['/api/health', '/uploads/site/image.png']) {
        assert.equal((await get(port, path, { Host: 'www.hdtlabx.com' })).status, 200);
      }
      const response = await get(port, '//evil.example/repair', { Host: 'www.hdtlabx.com' });
      assert.equal(response.headers.location, 'https://hdtlabx.com/');
    });
  });

  it('blocks admin indexing and excludes sitemap and ownership files on the admin host', async () => {
    const app = express();
    mountPublicSeo(app);
    app.get('/', (_req, res) => res.send('<html><head></head></html>'));
    await withServer(app, async (port) => {
      const headers = { Host: 'admin.hdtlabx.com' };
      const robots = await get(port, '/robots.txt', headers);
      assert.equal(robots.status, 200);
      assert.equal(robots.body, 'User-agent: *\nDisallow: /\n');
      const page = await get(port, '/', headers);
      assert.equal(page.headers['x-robots-tag'], 'noindex, nofollow');
      assert.equal((await get(port, '/sitemap.xml', headers)).status, 404);
      assert.equal((await get(port, '/googleea8ed839261ddcff.html', headers)).status, 404);
    });
  });

  it('serves the Google ownership file and favicon as exact public static files', async () => {
    const previousToken = process.env.GOOGLE_SITE_VERIFICATION;
    const previousFile = process.env.GOOGLE_SITE_VERIFICATION_FILE;
    delete process.env.GOOGLE_SITE_VERIFICATION;
    delete process.env.GOOGLE_SITE_VERIFICATION_FILE;
    try {
      const app = express();
      mountPublicSeo(app);
      app.use(express.static(path.join(__dirname, '../../frontend/public')));
      await withServer(app, async (port) => {
        const headers = { Host: 'hdtlabx.com' };
        const file = await get(port, '/googleea8ed839261ddcff.html', headers);
        assert.equal(file.status, 200);
        assert.equal(file.body, 'google-site-verification: googleea8ed839261ddcff.html\n');
        assert.equal(file.headers.location, undefined);
        const favicon = await get(port, '/favicon.svg', headers);
        assert.equal(favicon.status, 200);
        assert.match(favicon.headers['content-type'], /^image\/svg\+xml/);
        assert.equal(favicon.headers['x-robots-tag'], undefined);
        assert.equal((await get(port, '/googleunknownfile12.html', headers)).status, 404);
      });
    } finally {
      if (previousToken === undefined) delete process.env.GOOGLE_SITE_VERIFICATION;
      else process.env.GOOGLE_SITE_VERIFICATION = previousToken;
      if (previousFile === undefined) delete process.env.GOOGLE_SITE_VERIFICATION_FILE;
      else process.env.GOOGLE_SITE_VERIFICATION_FILE = previousFile;
    }
  });

  it('keeps customer delivery and repair confirmation links out of search without blocking access', async () => {
    const app = express();
    mountPublicSeo(app);
    app.get('*', (_req, res) => res.send('<html><head></head></html>'));
    await withServer(app, async (port) => {
      for (const url of ['/delivery/test-only-token', '/repair/confirm/test-only-token']) {
        const page = await get(port, url, { Host: 'hdtlabx.com' });
        assert.equal(page.status, 200);
        assert.equal(page.headers['x-robots-tag'], 'noindex, nofollow');
      }
      for (const url of ['/', '/film', '/repair', '/scan', '/shop']) {
        const page = await get(port, url, { Host: 'hdtlabx.com' });
        assert.equal(page.headers['x-robots-tag'], undefined);
      }
    });
  });
});

describe('Google site verification', () => {
  const prevToken = process.env.GOOGLE_SITE_VERIFICATION;
  const prevFile = process.env.GOOGLE_SITE_VERIFICATION_FILE;

  beforeEach(() => {
    process.env.GOOGLE_SITE_VERIFICATION = 'abcDEFghij1234567890_-xx';
    delete process.env.GOOGLE_SITE_VERIFICATION_FILE;
  });

  afterEach(() => {
    if (prevToken === undefined) delete process.env.GOOGLE_SITE_VERIFICATION;
    else process.env.GOOGLE_SITE_VERIFICATION = prevToken;
    if (prevFile === undefined) delete process.env.GOOGLE_SITE_VERIFICATION_FILE;
    else process.env.GOOGLE_SITE_VERIFICATION_FILE = prevFile;
  });

  it('injects a meta tag once', () => {
    const html = injectGoogleSiteVerification('<html><head><title>x</title></head></html>');
    assert.match(html, /name="google-site-verification" content="abcDEFghij1234567890_-xx"/);
    const twice = injectGoogleSiteVerification(html);
    assert.equal(twice.match(/google-site-verification/g).length, 1);
  });

  it('serves the HTML file only for the configured token', async () => {
    const app = express();
    mountPublicSeo(app);
    await withServer(app, async (port) => {
      const ok = await get(port, `/${googleVerificationFileName()}`, { Host: 'hdtlabx.com' });
      assert.equal(ok.status, 200);
      assert.equal(ok.body, googleHtmlBody());
      assert.equal(ok.body, `google-site-verification: ${googleVerificationFileName()}\n`);
      const miss = await get(port, '/googleotherfile12.html', { Host: 'hdtlabx.com' });
      assert.equal(miss.status, 404);
    });
  });
});
