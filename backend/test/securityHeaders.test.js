const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const { applySecurityHeaders, isAllowedOrigin, corsOrigin } = require('../middleware/security');
const { publicError } = require('../lib/httpSafety');
const { mapPublicQuote, mapTicket, isConfirmExpired } = require('../services/customerRepairService');
const { readSessionToken, SESSION_COOKIE } = require('../lib/sessionCookie');
const { getFilePublicUrl } = require('../services/deliveryFolderService');
const { validateCustomerInput } = require('../utils/customerNormalize');

function withServer(app, fn) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      Promise.resolve(fn(port))
        .then((value) => {
          server.close(() => resolve(value));
        })
        .catch((err) => {
          server.close(() => reject(err));
        });
    });
  });
}

function get(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path, headers }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      })
      .on('error', reject);
  });
}

describe('security headers', () => {
  it('sets hardening headers and hides Express', async () => {
    const app = express();
    app.disable('x-powered-by');
    app.use(applySecurityHeaders);
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    await withServer(app, async (port) => {
      const res = await get(port, '/ping');
      assert.equal(res.status, 200);
      assert.equal(res.headers['x-powered-by'], undefined);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'DENY');
      assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
      assert.match(String(res.headers['content-security-policy'] || ''), /frame-ancestors 'none'/);
      assert.match(String(res.headers['content-security-policy'] || ''), /script-src 'self'/);
    });
  });
});

describe('CORS allowlist', () => {
  it('allows the public and admin hosts, rejects arbitrary origins', () => {
    assert.equal(isAllowedOrigin('https://hdtlabx.com'), true);
    assert.equal(isAllowedOrigin('https://admin.hdtlabx.com'), true);
    assert.equal(isAllowedOrigin('https://evil.example'), false);
    let allowed;
    corsOrigin('https://evil.example', (_err, value) => {
      allowed = value;
    });
    assert.equal(allowed, false);
  });
});

describe('public errors', () => {
  it('does not leak internal messages on 500', async () => {
    const app = express();
    app.get('/boom', (_req, res) => {
      publicError(res, new Error('ECONNREFUSED mongodb://secret'), 'Không xử lý được yêu cầu');
    });
    await withServer(app, async (port) => {
      const res = await get(port, '/boom');
      assert.equal(res.status, 500);
      assert.equal(res.body.includes('mongodb'), false);
      assert.equal(res.body.includes('secret'), false);
      assert.match(res.body, /Không xử lý được yêu cầu/);
    });
  });
});

describe('public quote DTO', () => {
  it('omits internal cost fields', () => {
    const dto = mapPublicQuote({
      ticket_number: 'SRV-1',
      customer_name: 'Test User',
      model_name: 'Canon',
      serial_number: 'SN1',
      quote_amount: 100,
      quote_note: 'ok',
      quote_lines: [],
      deposit_amount: 0,
      status: 'cho_khach_xac_nhan',
      internal_parts_cost: 999,
      internal_labor_cost: 888,
      customer_email: 'hidden@example.com',
      profit_estimate: 1,
    });
    assert.equal(dto.internal_parts_cost, undefined);
    assert.equal(dto.customer_email, undefined);
    assert.equal(dto.profit_estimate, undefined);
    assert.equal(dto.ticket_number, 'SRV-1');
  });

  it('treats expired tokens as expired', () => {
    assert.equal(isConfirmExpired({ confirm_token_expires: new Date(Date.now() - 1000) }), true);
    assert.equal(isConfirmExpired({ confirm_token_expires: new Date(Date.now() + 60_000) }), false);
  });
});

describe('staff ticket DTO', () => {
  it('strips internal costs and work-log money', () => {
    const dto = mapTicket(
      {
        ticket_number: 'SRV-2',
        status: 'dang_sua',
        internal_parts_cost: 10,
        internal_labor_cost: 5,
        quote_amount: 100,
        work_logs: [{ description: 'a', parts_cost: 10, labor_cost: 5, total_cost: 15 }],
      },
      { includeInternal: false }
    );
    assert.equal(dto.internal_parts_cost, undefined);
    assert.equal(dto.profit_estimate, undefined);
    assert.equal(dto.work_logs[0].parts_cost, undefined);
    assert.equal(dto.work_logs[0].description, 'a');
  });
});

describe('session cookie', () => {
  it('reads sid from cookie and prefers Bearer', () => {
    assert.equal(
      readSessionToken({ headers: { cookie: `${SESSION_COOKIE}=from-cookie` } }),
      'from-cookie'
    );
    assert.equal(
      readSessionToken({
        headers: { authorization: 'Bearer from-header', cookie: `${SESSION_COOKIE}=from-cookie` },
      }),
      'from-header'
    );
  });
});

describe('delivery file URL', () => {
  it('serves files through tokenized API, not /uploads/delivery', () => {
    const url = getFilePublicUrl('aa'.repeat(16), 'scan.jpg');
    assert.match(url, /\/api\/delivery\//);
    assert.equal(url.includes('/uploads/delivery'), false);
  });
});

describe('customer validation', () => {
  it('rejects missing email/phone and clamps length', () => {
    const bad = validateCustomerInput({ firstName: 'A', lastName: 'B' });
    assert.ok(bad.errors.length >= 2);
    const long = validateCustomerInput({
      firstName: 'N'.repeat(200),
      lastName: 'L'.repeat(200),
      email: 'ok@example.com',
      phone: '0901234567',
      address: 'x'.repeat(900),
    });
    assert.equal(long.errors.length, 0);
    assert.equal(long.normalized.firstName.length, 80);
    assert.equal(long.normalized.address.length, 400);
  });
});
