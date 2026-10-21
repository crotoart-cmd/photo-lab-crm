const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const redirects = require('follow-redirects');

async function startServer(t, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

function getHeaders(url, options) {
  return new Promise((resolve, reject) => {
    const request = redirects.http.get(url, options, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('error', reject);
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.setTimeout(3000, () => request.destroy(new Error('Local redirect test timed out')));
    request.on('error', reject);
  });
}

test('array-form credential headers are stripped across origins (CVE-2026-111756)', async (t) => {
  const target = await startServer(t, (req, res) => res.end(JSON.stringify(req.headers)));
  const source = await startServer(t, (_req, res) => { res.writeHead(302, { Location: `${target}/received` }); res.end(); });
  const headers = await getHeaders(source, {
    headers: ['Host', new URL(source).host, 'Authorization', 'test-only-auth', 'Cookie', 'test-only-cookie=1', 'Proxy-Authorization', 'test-only-proxy', 'X-Safe', 'public-value'],
  });
  for (const key of ['authorization', 'cookie', 'proxy-authorization']) assert.equal(headers[key], undefined, `${key} must not cross origins`);
  assert.equal(headers['x-safe'], 'public-value');
});

test('declared credential header names with regex characters are stripped (CVE-2026-111755)', async (t) => {
  const target = await startServer(t, (req, res) => res.end(JSON.stringify(req.headers)));
  const source = await startServer(t, (_req, res) => { res.writeHead(302, { Location: target }); res.end(); });
  const headers = await getHeaders(source, {
    headers: { 'X-Auth^Key': 'test-only-one', 'X-Secret|Token': 'test-only-two', 'X-Safe': 'public-value' },
    sensitiveHeaders: ['X-Auth^Key', 'X-Secret|Token'],
  });
  assert.equal(headers['x-auth^key'], undefined);
  assert.equal(headers['x-secret|token'], undefined);
  assert.equal(headers['x-safe'], 'public-value');
});

test('same-origin redirects retain authentication and continue to work', async (t) => {
  const source = await startServer(t, (req, res) => {
    if (req.url === '/') { res.writeHead(302, { Location: '/received' }); res.end(); }
    else res.end(JSON.stringify(req.headers));
  });
  const headers = await getHeaders(source, { headers: { Authorization: 'test-only-auth', Cookie: 'test-only-cookie=1' } });
  assert.equal(headers.authorization, 'test-only-auth');
  assert.equal(headers.cookie, 'test-only-cookie=1');
});
