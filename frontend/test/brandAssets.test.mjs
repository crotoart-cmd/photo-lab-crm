import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const originals = {
  'hdt-labx-logo.svg': 'a08a55bde392c0241818ede63202c2c46ffaeded48c12cec1a436d9edd8669ce',
  'hdt-labx-logo.png': '4571b42dcb6235667caff5e3dfeee625828c69d2e91d9a6455631512af4cd1fc',
};

for (const [filename, checksum] of Object.entries(originals)) {
  test(`the original brand asset ${filename} remains unmodified`, async () => {
    const data = await readFile(new URL(`../public/${filename}`, import.meta.url));
    assert.equal(createHash('sha256').update(data).digest('hex'), checksum);
  });
}
