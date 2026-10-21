import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addRepairMedia, buildRepairSubmission, MIB, REPAIR_MEDIA_ACCEPT, repairMediaIssue, repairMediaKind, repairUploadProgress,
} from '../src/lib/repairMedia.js';
import { REPAIR_MEDIA_COPY, repairMediaT } from '../src/lib/repairMediaI18n.js';

const photo = (name = 'camera.jpg', size = MIB, type = 'image/jpeg') => ({ name, size, type });
const video = (size = MIB) => ({ name: 'fault.mp4', size, type: 'video/mp4' });

test('allowed extensions require a compatible MIME type, with empty and generic browser metadata supported', () => {
  for (const [extension, type, kind] of [
    ['jpg', 'image/jpeg', 'image'], ['jpeg', 'image/jpeg', 'image'], ['png', 'image/png', 'image'],
    ['webp', 'image/webp', 'image'], ['heic', 'image/heic', 'image'], ['heif', 'image/heif', 'image'],
    ['mp4', 'video/mp4', 'video'], ['mov', 'video/quicktime', 'video'], ['webm', 'video/webm', 'video'],
  ]) {
    assert.equal(repairMediaKind(photo(`device.${extension.toUpperCase()}`, 1, type)), kind);
    assert.equal(repairMediaKind(photo(`device.${extension}`, 1, '')), kind);
    assert.equal(repairMediaKind(photo(`device.${extension}`, 1, 'application/octet-stream')), kind);
    assert.ok(REPAIR_MEDIA_ACCEPT.includes(`.${extension}`));
  }
  for (const extension of ['gif', 'svg', 'html', 'pdf', 'exe', '']) assert.equal(repairMediaKind(photo(`device.${extension}`)), null);
  for (const type of ['text/html', 'image/svg+xml', 'application/pdf', 'video/mp4']) assert.equal(repairMediaKind(photo('device.jpg', 1, type)), null);
  assert.equal(repairMediaKind(photo('camera.jpg.html')), null);
  assert.equal(repairMediaKind(photo('camera')), null);
});

test('file count, video count, per-file limits and the combined limit include exact boundaries', () => {
  assert.equal(repairMediaIssue(Array.from({ length: 6 }, () => photo())), null);
  assert.equal(repairMediaIssue(Array.from({ length: 7 }, () => photo())), 'files');
  assert.equal(repairMediaIssue([video(), video()]), null);
  assert.equal(repairMediaIssue([video(), video(), video()]), 'videos');
  assert.equal(repairMediaIssue([photo('a.jpg', 10 * MIB)]), null);
  assert.equal(repairMediaIssue([photo('a.jpg', 10 * MIB + 1)]), 'image');
  assert.equal(repairMediaIssue([video(50 * MIB)]), null);
  assert.equal(repairMediaIssue([video(50 * MIB + 1)]), 'video');
  assert.equal(repairMediaIssue([video(50 * MIB), video(50 * MIB)]), null);
  assert.equal(repairMediaIssue([video(50 * MIB), video(50 * MIB), photo('a.jpg', 1)]), 'total');
  for (const size of [0, -1, NaN, Infinity]) assert.equal(repairMediaIssue([photo('a.jpg', size)]), 'empty');
});

test('rejected selections preserve existing files and accept valid files from the same selection', () => {
  const original = photo();
  const addition = photo('serial.png', 1, 'image/png');
  const current = [original];
  const result = addRepairMedia(current, [photo('bad.svg'), photo('large.jpg', 11 * MIB), addition]);
  assert.deepEqual(current, [original]);
  assert.deepEqual(result.files, [original, addition]);
  assert.deepEqual(result.errors, [{ name: 'bad.svg', code: 'type' }, { name: 'large.jpg', code: 'image' }]);
  const full = [video(), video(), photo(), photo(), photo(), photo()];
  assert.deepEqual(addRepairMedia(full, [photo()]).files, full);
  const twoVideos = addRepairMedia([video(), video()], [video()]);
  assert.equal(twoVideos.errors[0].code, 'videos');
});

test('legacy submissions stay JSON while multipart preserves text and repeats media with acknowledgment', () => {
  const fields = { firstName: 'An', serial_number: 'SN-1', symptom: 'Fault\nDetails', website: '' };
  assert.deepEqual(buildRepairSubmission(fields, [], false), fields);
  assert.ok(!(buildRepairSubmission(fields, [], true) instanceof FormData));
  const first = new File(['image bytes'], 'camera.jpg', { type: 'image/jpeg' });
  const second = new File(['video bytes'], 'fault.mov', { type: 'video/quicktime' });
  const body = buildRepairSubmission(fields, [first, second], true);
  assert.ok(body instanceof FormData);
  for (const [key, value] of Object.entries(fields)) assert.equal(body.get(key), value);
  assert.equal(body.get('media_acknowledged'), 'true');
  assert.deepEqual(body.getAll('media').map((file) => [file.name, file.size, file.type]), [[first.name, first.size, first.type], [second.name, second.size, second.type]]);
  assert.throws(() => buildRepairSubmission(fields, [first], false), /acknowledgment/);
  assert.throws(() => buildRepairSubmission(fields, [new File(['bad'], 'bad.html', { type: 'text/html' })], true), /type/);
});

test('upload progress supports unknown lengths and clamps inaccurate transport totals', () => {
  assert.equal(repairUploadProgress({ loaded: 25, total: 100 }), 25);
  assert.equal(repairUploadProgress({ loaded: 5 }), null);
  assert.equal(repairUploadProgress({ loaded: 5, total: 0 }), null);
  assert.equal(repairUploadProgress({ loaded: NaN, total: 10 }), null);
  assert.equal(repairUploadProgress({ loaded: 11, total: 10 }), 100);
  assert.equal(repairUploadProgress({ loaded: -1, total: 10 }), 0);
});

test('all four media locales contain the same complete copy and interpolate names and counts', () => {
  assert.deepEqual(Object.keys(REPAIR_MEDIA_COPY).sort(), ['de', 'en', 'es', 'vi']);
  for (const [lang, copy] of Object.entries(REPAIR_MEDIA_COPY)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(REPAIR_MEDIA_COPY.en).sort());
    assert.ok(Object.values(copy).every((value) => typeof value === 'string' && value.trim()));
    assert.ok(repairMediaT(lang, 'remove', { name: 'camera.jpg' }).includes('camera.jpg'));
    assert.ok(!repairMediaT(lang, 'count', { count: 2, videos: 1, size: '5 MiB' }).includes('{'));
  }
});
