// Crash regressions run in a child process, on loopback only, with no app data.
const assert = require('node:assert/strict');
const http = require('node:http');
const { PassThrough } = require('node:stream');
const zlib = require('node:zlib');
const express = require('express');

const scenario = process.argv[2];
const watchdog = setTimeout(() => { console.error('Parser lifecycle did not finish'); process.exit(1); }, 2000);
function finish() { clearTimeout(watchdog); console.log('parser lifecycle passed'); }

if (scenario === 'late-filter') {
  const multer = require('multer');
  const input = new PassThrough();
  const boundary = 'hdtlabx-regression-boundary';
  const part = (name) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${name}.txt"\r\nContent-Type: text/plain\r\n\r\nx\r\n`;
  const bytes = part('slow') + part('denied');
  let release, completions = 0;
  const denied = new Error('test-only rejection');
  input.headers = { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': Buffer.byteLength(bytes) };
  multer({ fileHwm: 1, fileFilter(req, file, callback) {
    if (file.fieldname === 'slow') release = callback;
    else req.once('end', () => setImmediate(() => callback(denied)));
  } }).any()(input, null, (error) => {
    assert.equal(error, denied);
    completions++;
    setImmediate(() => {
      assert.equal(typeof release, 'function');
      release(null, true);
      setTimeout(() => {
        assert.equal(completions, 1);
        assert.deepEqual(input.files, []);
        finish();
      }, 100);
    });
  });
  input.end(bytes);
} else {
  const app = express();
  const json = express.json();
  let client;
  const tail = Buffer.alloc(1024);
  app.post('/', (req, res, next) => json(req, res, (error) => {
    if (error) return next(error);
    if (scenario === 'early-deflate') {
      req.once('end', () => res.json(req.body));
      client.end(tail);
    } else res.json(req.body);
  }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).end());
  const server = app.listen(0, '127.0.0.1', () => {
    const initial = scenario === 'early-deflate'
      ? Buffer.concat([zlib.deflateSync('{"ok":true}'), Buffer.from([0])])
      : Buffer.concat([zlib.gzipSync('{"ok":true}'), Buffer.from([0]), Buffer.alloc(100 * 1024, 88)]);
    client = http.request({ hostname: '127.0.0.1', port: server.address().port, method: 'POST', path: '/', agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Encoding': scenario === 'early-deflate' ? 'deflate' : 'gzip',
        'Content-Length': initial.length + (scenario === 'early-deflate' ? tail.length : 0) } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => setTimeout(() => {
        assert.equal(res.statusCode, 200);
        assert.deepEqual(JSON.parse(body), { ok: true });
        server.close(finish);
      }, 100));
    });
    client.on('error', (error) => { throw error; });
    if (scenario === 'early-deflate') client.write(initial);
    else client.end(initial);
  });
}
