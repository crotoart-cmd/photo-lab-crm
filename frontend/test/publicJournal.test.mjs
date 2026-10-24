import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import postcss from 'postcss';

const compiled = await build({ stdin: { contents: `export * from './src/lib/publicJournal.js'; export * from './src/data/journalPreview.js'; export {JournalCard,JournalPager} from './src/components/public/JournalParts.jsx';`,
  resolveDir: new URL('..', import.meta.url).pathname, loader: 'jsx' }, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{"BASE_URL":"/"}' } });
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${compiled.outputFiles[0].text}\n})`)(createRequire(import.meta.url), module, module.exports);
const { journalPreviewPosts, journalPost, journalCopy, categoryFor, selectJournalPosts, journalPage, relatedJournalPosts, journalHref, JournalCard, JournalPager } = module.exports;
const posts = (lang = 'en') => journalPreviewPosts(lang).map(journalPost);

test('all three editorial categories have distinct stable URLs and EN/VI draft content', () => {
  for (const lang of ['en', 'vi']) {
    const items = posts(lang);
    assert.equal(items.length, 9); assert.equal(new Set(items.map((item) => item.slug)).size, 9);
    for (const category of ['photography', 'stories', 'repair']) assert.equal(items.filter((item) => item.category === category).length, 3);
    assert.ok(items.every((item) => item.draft && item.language === lang && item.blocks.length > 3 && item.minutes > 0));
    assert.ok(items.every((item) => journalHref(item, lang).endsWith(`?lang=${lang}`)));
  }
  assert.notEqual(posts('en')[0].title, posts('vi')[0].title);
  assert.equal(journalCopy('fr'), journalCopy('en'));
  assert.deepEqual(Object.keys(journalCopy('en')).sort(), Object.keys(journalCopy('vi')).sort());
});

test('search ignores Vietnamese accents and combines all terms with category filtering', () => {
  const vietnamese = posts('vi');
  assert.deepEqual(selectJournalPosts(vietnamese, { query: 'truoc con oc' }).map((item) => item.slug), selectJournalPosts(vietnamese, { query: 'trước con ốc' }).map((item) => item.slug));
  assert.ok(selectJournalPosts(vietnamese, { query: 'truoc con oc' }).some((item) => item.slug === 'before-the-first-screw'));
  assert.equal(selectJournalPosts(posts(), { category: 'repair' }).length, 3);
  assert.equal(selectJournalPosts(posts(), { category: 'stories', query: 'inspection' }).length, 0);
  assert.equal(selectJournalPosts(posts(), { query: 'zzzz-no-such-story' }).length, 0);
  assert.ok(selectJournalPosts(posts(), { query: 'inspection' }).some((item) => item.category === 'repair'));
});

test('pagination clamps malformed pages and never drops or duplicates a story', () => {
  const items = posts();
  assert.equal(journalPage(items, 'NaN').page, 1);
  assert.equal(journalPage(items, -10).page, 1);
  assert.equal(journalPage(items, '1.5').page, 1);
  assert.equal(journalPage(items, 999).page, 2);
  assert.equal(journalPage([], 5).page, 1);
  const all = [...journalPage(items, 1).items, ...journalPage(items, 2).items];
  assert.deepEqual(all.map((item) => item.slug), items.map((item) => item.slug));
});

test('legacy body and kind fields remain readable without an article migration', () => {
  const old = journalPost({ slug: 'old', kind: 'Sửa máy', title: 'Old article', body: 'Opening.\n\n## Inspection\nOriginal text.' });
  assert.equal(old.category, 'repair');
  assert.deepEqual(old.blocks.map((block) => block.type), ['paragraph', 'heading', 'paragraph']);
  assert.equal(old.blocks[2].text, 'Original text.');
  assert.equal(old.language, null);
  assert.equal(categoryFor({ kind: 'Chemistry' }), 'photography');
  assert.equal(categoryFor({ kind: 'Photo essay' }), 'stories');
});

test('related reading excludes the current article and favors the same subject', () => {
  const items = posts(), current = items.find((item) => item.category === 'repair');
  const related = relatedJournalPosts(items, current);
  assert.equal(related.length, 3); assert.ok(related.every((item) => item.slug !== current.slug));
  assert.equal(related[0].category, 'repair'); assert.equal(related[1].category, 'repair');
});

test('all preview photographs exist locally and galleries have captions without private intake data', async () => {
  const sources = new Set();
  for (const item of posts()) {
    sources.add(item.image);
    for (const block of item.blocks) for (const image of block.type === 'gallery' ? block.images : block.type === 'image' ? [block] : []) {
      assert.ok(image.caption && image.alt); sources.add(image.src);
    }
  }
  for (const source of sources) {
    assert.match(source, /^\/media\/(lab|about)\//);
    assert.ok((await fs.stat(new URL(`../public${source}`, import.meta.url))).size > 0);
  }
});

test('cards escape article text and preserve filter context when opening related stories', () => {
  const post = { ...posts()[0], title: '<script>alert(1)</script>' };
  const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: { pathname: '/blog/example', search: '?lang=en', state: { journalSearch: '?lang=en&category=repair' } } }, React.createElement(JournalCard, { post, lang: 'en', copy: journalCopy('en') })));
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('/blog/between-light-and-shade?lang=en'));
});

test('large archives have a bounded pager with previous/next labels', () => {
  const html = renderToStaticMarkup(React.createElement(JournalPager, { page: 40, pages: 1000, onPage() {}, copy: journalCopy('en') }));
  assert.equal((html.match(/<button/g) || []).length, 7);
  assert.ok(html.includes('Previous page')); assert.ok(html.includes('Next page')); assert.ok(html.includes('aria-current="page"'));
});

test('journal styles are scoped, reserve image ratios and honor reduced motion', async () => {
  const css = await fs.readFile(new URL('../src/styles/public-journal.css', import.meta.url), 'utf8');
  const ast = postcss.parse(css);
  ast.walkDecls('font-size', ({ value }) => assert.doesNotMatch(value, /vw|vmin/));
  ast.walkDecls('letter-spacing', ({ value }) => assert.equal(value, '0'));
  ast.walkRules((rule) => assert.ok(rule.selectors.every((part) => /journal/.test(part))));
  assert.match(css, /prefers-reduced-motion/); assert.match(css, /aspect-ratio/);
});

test('demo content is behind an explicit dev-only flag, never a production API seed', async () => {
  const hook = await fs.readFile(new URL('../src/hooks/useJournalPosts.js', import.meta.url), 'utf8');
  assert.match(hook, /import\.meta\.env\.DEV && import\.meta\.env\.VITE_JOURNAL_PREVIEW === 'true'/);
  assert.doesNotMatch(hook, /publicApi\.(post|patch|delete)/);
  const page = await fs.readFile(new URL('../src/pages/PublicBlogPost.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
});
