import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeliveryLink, safeDeliveryFileUrl, isDeliveryImage } from '../src/lib/publicDeliveryLink.js';

const token = 'a1'.repeat(32);

test('album links navigate internally and never retain query parameters or fragments', () => {
  assert.equal(parseDeliveryLink(`https://lab.example/delivery/${token}?source=email#private`), `/delivery/${token}`);
  assert.equal(parseDeliveryLink(` /delivery/${token}/ `), `/delivery/${token}`);
});

test('album links require a plausible protected token and a precise delivery path', () => {
  for (const value of ['', '12345', '/delivery/order-123', `/repair/${token}`, `/delivery/${token}/file/a.jpg`, `javascript:/delivery/${token}`, `https://name:password@example.com/delivery/${token}`, `/delivery/${'a'.repeat(129)}`, `/delivery/${token}%2Ffile`]) {
    assert.equal(parseDeliveryLink(value), null, value);
  }
});

test('file links allow HTTP(S) and relative assets but reject active content URLs', () => {
  assert.equal(safeDeliveryFileUrl('/api/delivery/token/file/photo.jpg'), '/api/delivery/token/file/photo.jpg');
  assert.equal(safeDeliveryFileUrl('https://lab.example/photo.jpg'), 'https://lab.example/photo.jpg');
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,test', 'file:///private/test', 'https://user:pass@lab.example/a.jpg', '']) {
    assert.equal(safeDeliveryFileUrl(url), null);
  }
});

test('only browser-previewable raster files enter the image viewer', () => {
  assert.equal(isDeliveryImage({ name: 'FRAME01.JPG' }), true);
  assert.equal(isDeliveryImage({ filename: 'photo.webp' }), true);
  for (const name of ['image.svg', 'scan.tiff', 'photo.jpg.html', 'document.pdf', '']) assert.equal(isDeliveryImage({ name }), false);
});
