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
import { REPAIR_MEDIA_COPY } from '../src/lib/repairMediaI18n.js';

const require = createRequire(import.meta.url);
const result = await build({
  stdin: {
    contents: `export { default as Picker } from './src/components/public/RepairMediaPicker.jsx';
      export { default as Wizard } from './src/components/public/PublicMobileRepairIntake.jsx';
      export { PublicLocaleProvider } from './src/components/public/PublicLocale.jsx';`,
    resolveDir: new URL('..', import.meta.url).pathname,
    loader: 'jsx',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', logLevel: 'silent',
});
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${result.outputFiles[0].text}\n})`)(require, module, module.exports);
const { Picker, Wizard, PublicLocaleProvider } = module.exports;
const image = { name: 'serial-and-body.jpg', type: 'image/jpeg', size: 128000, lastModified: 1 };
const video = { name: 'shutter-fault.mp4', type: 'video/mp4', size: 256000, lastModified: 2 };
const render = (props = {}) => renderToStaticMarkup(React.createElement(Picker, { files: [], onChange() {}, lang: 'vi', compact: true, ...props }));

test('mobile empty state keeps file rules collapsed and removes redundant empty copy', () => {
  for (const lang of ['vi', 'en', 'de', 'es']) {
    const html = render({ lang });
    assert.ok(html.includes('repair-media--compact'));
    assert.ok(html.includes(renderToStaticMarkup(React.createElement(React.Fragment, null, REPAIR_MEDIA_COPY[lang].compactTitle))));
    assert.ok(html.includes('class="repair-media-empty"'));
    assert.ok(html.includes('<details class="repair-media-rules"><summary>'));
    assert.ok(!html.includes(REPAIR_MEDIA_COPY[lang].none));
    assert.ok(html.includes('type="file" multiple=""'));
    assert.ok(!html.includes('<details open'));
  }
});

test('mobile selected state keeps original file names and a dedicated add-more tile', () => {
  const html = render({ files: [image, video] });
  assert.ok(html.includes('serial-and-body.jpg'));
  assert.ok(html.includes('shutter-fault.mp4'));
  assert.equal((html.match(/class="repair-media-item"/g) || []).length, 2);
  assert.equal((html.match(/class="repair-media-remove"/g) || []).length, 2);
  assert.ok(html.includes('repair-media-add-slot'));
  assert.ok(html.includes('2/6'));
  assert.ok(!html.includes('repair-media-empty'));
  assert.ok(!html.includes('type="submit"'));
});

test('mobile review has no edit affordances and omits an empty attachment section', () => {
  assert.equal(render({ review: true }), '');
  const html = render({ files: [image], review: true });
  for (const name of ['repair-media-remove', 'repair-media-add-slot', 'repair-media-rules', 'type="file"']) assert.ok(!html.includes(name));
  assert.ok(html.includes(image.name));
});

test('full selections and submission state disable further editing', () => {
  const html = render({ files: Array.from({ length: 6 }, (_, index) => ({ ...image, name: `${index}.jpg` })), disabled: true });
  assert.ok(!html.includes('repair-media-add-slot'));
  assert.equal((html.match(/class="repair-media-remove" disabled=""/g) || []).length, 6);
  assert.ok(html.includes('disabled=""'));
});

test('default presentation retains desktop copy and its existing grid', () => {
  const html = render({ compact: false });
  assert.ok(html.includes(REPAIR_MEDIA_COPY.vi.title));
  assert.ok(html.includes(REPAIR_MEDIA_COPY.vi.none));
  assert.ok(html.includes('repair-media-add'));
  assert.ok(!html.includes('repair-media--compact'));
  assert.ok(!html.includes('repair-media-rules'));
});

test('mobile wizard keeps condition fields optional without hiding the attachment action', () => {
  const empty = { model_name: '', brand: '', serial_number: '', symptom: '', condition_at_intake: '', firstName: '', lastName: '', email: '', phone: '', intake_note: '' };
  const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: '/repair' }, React.createElement(PublicLocaleProvider, null, React.createElement(Wizard, {
    form: empty, setForm() {}, website: '', setWebsite() {}, saving: false, error: '', done: '', onSubmit() {}, onReset() {}, clearError() {},
    mediaFiles: [], onMediaChange() {}, mediaAcknowledged: false, onMediaAcknowledged() {},
  }))));
  assert.ok(html.includes('<details class="pm-repair-extra pm-repair-condition">'));
  assert.ok(html.includes('name="serial_number"'));
  assert.ok(html.includes('name="condition_at_intake"'));
  assert.ok(html.indexOf('</details>') < html.indexOf('repair-media--compact'));
});

test('compact styles are mobile-scoped and give previews stable tracks with contained scrolling', async () => {
  const ast = postcss.parse(await fs.readFile(new URL('../src/styles/repair-media.css', import.meta.url), 'utf8'));
  let strip;
  ast.walkRules((rule) => {
    if (/repair-media--compact|repair-media-empty|repair-media-rules|repair-media-remove|repair-media-add-slot|pm-repair-condition/.test(rule.selector)) {
      let parent = rule.parent;
      while (parent && !(parent.type === 'atrule' && parent.name === 'media')) parent = parent.parent;
      assert.ok(parent?.params.includes('max-width: 767px'), rule.selector);
    }
    if (rule.selector === '.repair-media--compact .repair-media-grid') strip = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]));
  });
  assert.equal(strip['grid-auto-columns'], '116px');
  assert.equal(strip['overflow-x'], 'auto');
  assert.equal(strip.width, '100%');
});
