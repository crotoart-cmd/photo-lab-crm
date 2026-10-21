import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const compile = `
  const { createRequire } = require('node:module');
  const { createHash } = require('node:crypto');
  const requireFrontend = createRequire(${JSON.stringify(new URL('../package.json', import.meta.url).href)});
  const postcss = requireFrontend('postcss');
  const tailwind = requireFrontend('tailwindcss');
  (async () => {
    const result = await postcss([tailwind({ config: ${JSON.stringify(`${frontend}/tailwind.config.js`)} })])
      .process('@tailwind utilities;', { from: ${JSON.stringify(`${frontend}/src/index.css`)} });
    const rules = {};
    result.root.walkRules((rule) => { rules[rule.selector] = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value])); });
    console.log(JSON.stringify({ rules, hash: createHash('sha256').update(result.css).digest('hex') }));
  })().catch((error) => { console.error(error.message); process.exitCode = 1; });
`;

function fromDirectory(cwd) {
  const child = spawnSync(process.execPath, ['-e', compile], { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

test('admin layout utilities are generated when Vite starts outside the frontend directory', () => {
  const { rules } = fromDirectory(tmpdir());
  assert.equal(rules['.flex']?.display, 'flex');
  assert.equal(rules['.flex-1']?.flex, '1 1 0%');
  assert.equal(rules['.min-w-0']?.['min-width'], '0px');
  assert.equal(rules['.grid']?.display, 'grid');
  assert.equal(rules['.hidden']?.display, 'none');
  assert.equal(rules['.md\\:hidden']?.display, 'none');
  assert.equal(rules['.md\\:flex']?.display, 'flex');
});

test('changing the launcher directory does not alter generated application CSS', () => {
  assert.equal(fromDirectory(tmpdir()).hash, fromDirectory(frontend).hash);
});

test('the actual Vite PostCSS pipeline resolves layout styles outside the frontend directory', () => {
  const code = `
    import { createServer } from ${JSON.stringify(new URL('../node_modules/vite/dist/node/index.js', import.meta.url).href)};
    const vite = await createServer({
      root: ${JSON.stringify(frontend)}, configFile: ${JSON.stringify(`${frontend}/vite.config.js`)},
      configLoader: 'runner', logLevel: 'silent',
      server: { middlewareMode: true, watch: null, hmr: false, preTransformRequests: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const result = await vite.transformRequest('/src/index.css?direct');
      console.log(JSON.stringify({ flex: result.code.includes('.flex {'), responsive: result.code.includes('.md\\\\:hidden {') }));
    } finally { await vite.close(); }
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: tmpdir(), encoding: 'utf8', maxBuffer: 1024 * 1024 });
  assert.equal(child.status, 0, child.stderr);
  const styles = JSON.parse(child.stdout);
  assert.equal(styles.flex, true, 'Vite must actually emit the flex layout utility');
  assert.equal(styles.responsive, true, 'Vite must actually emit responsive visibility utilities');
});
