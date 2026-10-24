import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { build } from 'esbuild';
import postcss from 'postcss';

const require = createRequire(import.meta.url);
const result = await build({
  stdin: {
    contents: `export * from './src/config/publicMobileNavigation.js';
      export { PATH } from './src/config/publicPaths.js';
      export { publicT } from './src/lib/publicI18n.js';
      export { default as Tabs } from './src/components/public/PublicMobileTabs.jsx';
      export { default as Home } from './src/components/public/PublicMobileHome.jsx';
      export { default as Film } from './src/components/public/PublicMobileFilm.jsx';
      export * from './src/components/public/PublicMobileService.jsx';
      export { PublicLocaleProvider } from './src/components/public/PublicLocale.jsx';`,
    resolveDir: new URL('..', import.meta.url).pathname,
    loader: 'jsx',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', logLevel: 'silent',
  define: { 'import.meta.env': '{"BASE_URL":"/"}' },
});
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${result.outputFiles[0].text}\n})`)(require, module, module.exports);
const { MOBILE_FILM_SERVICES, MOBILE_MORE, MOBILE_TABS, mobileTabForPath, PATH, publicT, Tabs, Home, Film, PublicMobileScan, PublicMobilePrint, PublicMobileSpeed, PublicLocaleProvider } = module.exports;

function render(Component, path = '/', lang = 'vi') {
  const previousWindow = globalThis.window;
  globalThis.window = { location: new URL(`${path}?site=public&lang=${lang}`, 'http://localhost') };
  try {
    return renderToStaticMarkup(React.createElement(StaticRouter, { location: path },
      React.createElement(PublicLocaleProvider, null, React.createElement(Component))));
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test('film owns its three existing subservice URLs, including trailing slashes and descendants', () => {
  assert.deepEqual(MOBILE_FILM_SERVICES.map((service) => service.to), ['/scan', '/in-analog', '/toc-do']);
  for (const path of [PATH.film, ...MOBILE_FILM_SERVICES.map((service) => service.to)]) {
    for (const suffix of ['', '/', '/detail']) assert.equal(mobileTabForPath(`${path}${suffix}`), 'film');
  }
});

test('route ownership respects path boundaries and preserves other tabs', () => {
  for (const path of ['/scanner', '/scan-old', '/filmstrip', '/toc-do-old', '/in-analog-old', '/shopping']) assert.equal(mobileTabForPath(path), 'more');
  for (const tab of MOBILE_TABS) assert.equal(mobileTabForPath(tab.to), tab.id);
  for (const path of ['/repair/new', '/repair/track']) assert.equal(mobileTabForPath(path), 'repair');
  assert.equal(mobileTabForPath('/shop/item'), 'shop');
  assert.equal(mobileTabForPath('/blog/post'), 'more');
});

test('More retains Blog, About, Contact and FAQ without any film subservice', () => {
  assert.deepEqual(MOBILE_MORE.map((item) => item.to), [PATH.blog, PATH.about, PATH.contact, PATH.faq]);
  assert.ok(MOBILE_MORE.every((item) => mobileTabForPath(item.to) === 'more'));
});

test('each film detail page activates Film, not More, in the rendered bottom navigation', () => {
  for (const service of MOBILE_FILM_SERVICES) {
    const html = render(Tabs, service.to);
    const selected = [...html.matchAll(/<a\b[^>]*class="is-on"[^>]*>/g)].map((match) => match[0]);
    assert.equal(selected.length, 1);
    assert.ok(selected[0].includes('href="/film"'));
    assert.ok(selected[0].includes('aria-current="location"'));
    assert.ok(!/<button[^>]*class="is-on"/.test(html));
  }
  assert.ok(render(Tabs, '/film').includes('aria-current="page"'));
});

test('Home omits film subservices while retaining the Film CTA and Repair then Blog then Shop', () => {
  const html = render(Home);
  assert.ok(!html.includes('class="pm-film-services"'));
  for (const service of MOBILE_FILM_SERVICES) assert.ok(!html.includes(`href="${service.to}"`));
  assert.ok(html.includes('href="/film"'));
  assert.ok(html.indexOf('pm-home-repair"') < html.indexOf('id="pm-home-blog"'));
  assert.ok(html.indexOf('id="pm-home-blog"') < html.indexOf('id="pm-home-shop"'));
  assert.ok(!html.includes('class="pm-lab-window"'));
  assert.ok(!html.includes('class="pm-services"'));
  assert.ok(html.includes('hdt-labx-logo.svg'));
});

test('Film offers the three subservices together after the complete Film and scan intake section', () => {
  const html = render(Film, PATH.film);
  assert.equal((html.match(/class="pm-film-services"/g) || []).length, 1);
  assert.equal((html.match(/class="pm-film-service"/g) || []).length, 3);
  for (const service of MOBILE_FILM_SERVICES) assert.equal(html.split(`href="${service.to}"`).length - 1, 1);
  const servicesIndex = html.indexOf('class="pm-film-services"');
  const formEnd = html.lastIndexOf('</form>');
  assert.ok(formEnd > html.indexOf('class="ps-mstep-title"'));
  assert.ok(html.indexOf('</section>', formEnd) < servicesIndex);
  assert.ok(servicesIndex > html.indexOf(publicT('vi', 'exp.filmStep')));
  assert.ok(html.includes('id="mobile-film-title"'));
  assert.ok(html.includes('<form aria-busy="false">'));
  assert.ok(html.includes('class="ps-mprogress"'));
  assert.ok(html.includes(publicT('vi', 'mpage.next')));
});

test('Scan, Print and Speed return to their Film parent and keep their intake entry point', () => {
  // Scan and Print embed their own order wizard; Speed still links to the film intake.
  for (const [Page, path, intake] of [[PublicMobileScan, PATH.scan, /id="mobile-scan-intake"/],
    [PublicMobilePrint, PATH.print, /id="mobile-print-intake"/],
    [PublicMobileSpeed, PATH.speed, /<a[^>]*class="ps-mcta ps-mcta--fill"[^>]*href="\/film"/]]) {
    const html = render(Page, path);
    assert.match(html, /<a[^>]*class="ps-mback"[^>]*href="\/film"/);
    assert.match(html, intake);
  }
});

test('film services retain translated titles and hints for every public language', () => {
  for (const lang of ['vi', 'en', 'de', 'es']) {
    const html = render(Film, PATH.film, lang);
    for (const item of MOBILE_FILM_SERVICES) {
      for (const key of [item.key, item.hint]) {
        const text = publicT(lang, key);
        assert.notEqual(text, key);
        assert.ok(html.includes(renderToStaticMarkup(React.createElement(React.Fragment, null, text))));
      }
    }
  }
});

test('film service styles stay mobile-only, wrap labels and reserve stable icon tracks', async () => {
  const ast = postcss.parse(await fs.readFile(new URL('../src/styles/public-mobile-experience.css', import.meta.url), 'utf8'));
  const rules = new Map();
  ast.walkRules((rule) => {
    if (!/\.pm-film-service/.test(rule.selector)) return;
    let parent = rule.parent;
    while (parent && !(parent.type === 'atrule' && parent.name === 'media')) parent = parent.parent;
    assert.ok(parent?.params.includes('max-width: 767px'), rule.selector);
    rules.set(rule.selector, Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value])));
  });
  assert.equal(rules.get('.pm-film-service')['grid-template-columns'], '24px minmax(0, 1fr) 20px');
  assert.equal(rules.get('.pm-film-service')['min-height'], '68px');
  assert.equal(rules.get('.pm-film-service-copy')['overflow-wrap'], 'anywhere');
  assert.equal(rules.get('.pm-film-service-copy')['min-width'], '0');
});
