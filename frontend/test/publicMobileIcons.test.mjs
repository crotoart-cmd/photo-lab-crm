import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Film, House, ShoppingBag, Wrench } from 'lucide-react';
import { PUBLIC_MOBILE_ICONS } from '../src/lib/publicMobileIcons.js';

test('mobile tabs use recognizable icons from one family', () => {
  assert.equal(PUBLIC_MOBILE_ICONS.home, House);
  assert.equal(PUBLIC_MOBILE_ICONS.movie, Film);
  assert.equal(PUBLIC_MOBILE_ICONS.build, Wrench);
  assert.equal(PUBLIC_MOBILE_ICONS.storefront, ShoppingBag);
});

test('mobile customer controls all have matching vector icons', () => {
  for (const name of ['movie', 'camera', 'camera_alt', 'favorite', 'lock', 'grid_view', 'add_circle_outline', 'verified_user', 'hourglass_top', 'photo_library', 'download', 'close', 'edit', 'zoom_in', 'zoom_out']) {
    assert.ok(PUBLIC_MOBILE_ICONS[name], name);
  }
});

test('icons share a 24px viewport, rounded strokes and inherited color', () => {
  for (const [name, Icon] of Object.entries(PUBLIC_MOBILE_ICONS)) {
    const svg = renderToStaticMarkup(createElement(Icon, { size: 24, strokeWidth: 1.8 }));
    assert.match(svg, /viewBox="0 0 24 24"/, name);
    assert.match(svg, /stroke="currentColor"/, name);
    assert.match(svg, /stroke-linecap="round"/, name);
    assert.match(svg, /stroke-linejoin="round"/, name);
    assert.match(svg, /<(path|circle|rect|line|polyline|polygon|ellipse)\b/, name);
  }
});

test('rendered icons contain no active content or external references', () => {
  for (const [name, Icon] of Object.entries(PUBLIC_MOBILE_ICONS)) {
    const svg = renderToStaticMarkup(createElement(Icon));
    assert.doesNotMatch(svg, /<(script|foreignObject|image|use)\b|\b(onload|onclick|href)=|url\(|javascript:/i, name);
  }
});
