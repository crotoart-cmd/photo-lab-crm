const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const nodemailer = require('nodemailer');
const parseAddress = require('nodemailer/lib/addressparser');

// Scenarios cover GHSA-27r3-jxmh-p828 and GHSA-q7qp-rjg7-q26m.
for (const scenario of ['early-deflate', 'trailing-gzip', 'late-filter']) {
  test(`parser process survives ${scenario}`, () => {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'fixtures/parser-lifecycle.cjs'), scenario], {
      encoding: 'utf8', timeout: 4000, env: { PATH: process.env.PATH, NODE_ENV: 'test' },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /parser lifecycle passed/);
  });
}

const recipients = [
  ['nested comment', 'Client (outer(inner) <wrong@untrusted.test>) <client@allowed.test>', 'client@allowed.test'],
  ['semicolon in comment', 'Clients: (note; <wrong@untrusted.test>) <client@allowed.test>;', 'client@allowed.test'],
  ['quoted local part', '<"local@untrusted.test>"@allowed.test>', '"local@untrusted.test>"@allowed.test'],
];
for (const [shape, to, expected] of recipients) {
  test(`email parsing and envelope do not redirect the recipient for ${shape}`, async () => {
    assert.deepEqual(parseAddress(to, { flatten: true }).map((entry) => entry.address), [expected]);
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const result = await transport.sendMail({ from: 'HDTLabx <lab@example.test>', to, subject: 'Test only', text: 'Local email regression.' });
    assert.equal(result.envelope.to.length, 1);
    // SMTP composition normalizes quoted local parts; the recipient domain must not change.
    assert.equal(result.envelope.to[0].slice(result.envelope.to[0].lastIndexOf('@') + 1), 'allowed.test');
    assert.ok(Buffer.isBuffer(result.message));
    transport.close();
  });
}

test('normal customer email and attachments still compose without SMTP', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const result = await transport.sendMail({ from: 'HDTLabx <lab@example.test>', to: 'Customer <customer@example.test>',
    subject: 'Film received', text: 'HDTLabx: film & repair', html: '<p>Film &amp; repair</p>',
    attachments: [{ filename: 'receipt.txt', content: 'test-only receipt' }] });
  assert.deepEqual(result.envelope.to, ['customer@example.test']);
  assert.match(result.message.toString('utf8'), /multipart\/mixed/);
  assert.match(result.message.toString('utf8'), /receipt\.txt/);
  transport.close();
});
