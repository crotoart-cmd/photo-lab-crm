import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const { publicPageMetadata } = require('../../backend/lib/publicSeoMetadata');
const copy = require('../../backend/lib/publicSeoData.json');
const result = await build({ entryPoints: [new URL('../src/lib/publicSeo.js', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'cjs' });
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${result.outputFiles[0].text}\n})`)(require, module, module.exports);
const { publicMetadata } = module.exports;

test('client navigation and server HTML use identical SEO for all languages and public pages', () => {
  for (const lang of Object.keys(copy)) {
    for (const pathname of [...Object.keys(copy.en), '/sua-may/', '/phu-kien', '/blog/after-the-scans']) {
      assert.deepEqual(publicMetadata(pathname, lang), publicPageMetadata(pathname, lang));
    }
  }
  assert.equal(publicMetadata('/delivery/private-token', 'en'), null);
});
