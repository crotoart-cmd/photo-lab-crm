const fs = require('node:fs');

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PRIVATE_METADATA = new Set(['eXIf', 'iTXt', 'tEXt', 'zTXt']);

function withoutPngMetadata(input) {
  if (!input.subarray(0, 8).equals(SIGNATURE)) throw new Error('Expected a PNG photograph');
  const chunks = [SIGNATURE];
  let offset = 8;
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > input.length) throw new Error('Incomplete PNG chunk');
    const type = input.toString('ascii', offset + 4, offset + 8);
    if (!PRIVATE_METADATA.has(type)) chunks.push(input.subarray(offset, end));
    offset = end;
    if (type === 'IEND') return Buffer.concat(chunks);
  }
  throw new Error('Missing PNG end chunk');
}

if (require.main === module) {
  for (const file of process.argv.slice(2)) {
    fs.writeFileSync(file, withoutPngMetadata(fs.readFileSync(file)));
  }
}

module.exports = { withoutPngMetadata };
