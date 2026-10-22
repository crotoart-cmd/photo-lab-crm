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
import { ABOUT_COPY, ABOUT_FOUNDERS, publicAboutCopy } from '../src/lib/publicAbout.js';

const require = createRequire(import.meta.url);
const result = await build({
  stdin: { contents: `export { default as About } from './src/pages/PublicAbout.jsx'; export { PublicLocaleProvider } from './src/components/public/PublicLocale.jsx';`, resolveDir: new URL('..', import.meta.url).pathname, loader: 'jsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' },
  define: { 'import.meta.env': '{"BASE_URL":"/"}' },
});
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${result.outputFiles[0].text}\n})`)(require, module, module.exports);
const { About, PublicLocaleProvider } = module.exports;

function render(lang) {
  const previous = globalThis.window;
  globalThis.window = { location: new URL(`https://hdtlabx.com/about?lang=${lang}`) };
  try {
    return renderToStaticMarkup(React.createElement(StaticRouter, { location: `/about?lang=${lang}` }, React.createElement(PublicLocaleProvider, null, React.createElement(About))));
  } finally {
    if (previous === undefined) delete globalThis.window; else globalThis.window = previous;
  }
}

test('founder images and roles follow the exact order supplied by the user', () => {
  assert.deepEqual(ABOUT_FOUNDERS.map(({ name }) => name), ['Hoang Dao', 'Dang Tran Truong', 'Ti Story']);
  assert.deepEqual(ABOUT_FOUNDERS.map(({ letter }) => letter), ['H', 'D', 'T']);
  assert.deepEqual(ABOUT_COPY.en.founders.map(({ role }) => role), ['Heritage', 'Detail', 'Technology']);
  assert.deepEqual(ABOUT_COPY.en.founders.map(({ place }) => place), ['United States', 'Da Lat', 'Saigon']);
});

test('every locale has the full story, three biographies, four missions and five values', () => {
  for (const lang of ['en', 'vi', 'de', 'es']) {
    const copy = publicAboutCopy(lang);
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(ABOUT_COPY.en).sort());
    assert.equal(copy.story.length, 3);
    assert.equal(copy.founders.length, 3);
    assert.ok(copy.founders.every((founder) => founder.paragraphs.length === 2));
    assert.equal(copy.missions.length, 4);
    assert.equal(copy.values.length, 5);
    const html = render(lang);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.equal((html.match(/class="about-portrait"/g) || []).length, 3);
    for (const founder of ABOUT_FOUNDERS) {
      assert.ok(html.includes(`id="${founder.id}"`));
      assert.ok(html.includes(`src="${founder.image}"`));
    }
    assert.ok(html.includes('href="/repair"'));
    assert.ok(html.includes('href="/film"'));
    assert.ok(html.includes('href="/contact"'));
  }
  assert.equal(publicAboutCopy('fr'), ABOUT_COPY.en);
});

test('portrait framing is circular, grayscale and keeps fixed responsive tracks', async () => {
  const ast = postcss.parse(await fs.readFile(new URL('../src/styles/public-about.css', import.meta.url), 'utf8'));
  const declarations = (selector) => {
    const rule = ast.nodes.find((node) => node.type === 'rule' && node.selector === selector);
    return Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map(({ prop, value }) => [prop, value]));
  };
  const portrait = declarations('.about-portrait');
  assert.equal(portrait['aspect-ratio'], '1');
  assert.equal(portrait['border-radius'], '50%');
  assert.equal(portrait.overflow, 'hidden');
  assert.equal(declarations('.about-portrait img').filter, 'grayscale(1)');
  assert.equal(declarations('.about-people')['grid-template-columns'], 'repeat(3, minmax(0, 1fr))');
  ast.walkDecls('font-size', ({ value }) => assert.doesNotMatch(value, /vw/));
  ast.walkDecls('letter-spacing', ({ value }) => assert.equal(value, '0'));
});

test('only portrait metadata is removed; compressed image pixels are preserved', async () => {
  const { withoutPngMetadata } = require('../../scripts/prepare-about-portraits.cjs');
  for (const founder of ABOUT_FOUNDERS) {
    const bytes = await fs.readFile(new URL(`../public${founder.image}`, import.meta.url));
    assert.ok(bytes.equals(withoutPngMetadata(bytes)));
    // A disposable metadata chunk must leave every original image chunk intact.
    const metadata = Buffer.alloc(12);
    metadata.write('tEXt', 4, 'ascii');
    const withMetadata = Buffer.concat([bytes.subarray(0, 8), metadata, bytes.subarray(8)]);
    assert.ok(bytes.equals(withoutPngMetadata(withMetadata)));
  }
  assert.throws(() => withoutPngMetadata(Buffer.from('not an image')));
});
