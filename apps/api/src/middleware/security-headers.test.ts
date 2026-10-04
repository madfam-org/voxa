import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import app from '../app.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';
import { allowedOrigins, isAllowedOrigin } from './cors.js';

describe('API security headers', () => {
  beforeEach(() => {
    useTestStore(createFileBoardStore());
  });

  it('hardens /health', async () => {
    const res = await app.request('/health');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-site');
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'none'/);
  });

  it('hardens error responses too', async () => {
    const res = await app.request('/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  it('serves robots.txt that disallows everything', async () => {
    const res = await app.request('/robots.txt');
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'User-agent: *\nDisallow: /\n');
  });
});

describe('CORS allow-list', () => {
  const saved = { origins: process.env.CORS_ALLOWED_ORIGINS, nodeEnv: process.env.NODE_ENV };

  afterEach(() => {
    if (saved.origins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = saved.origins;
    if (saved.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved.nodeEnv;
  });

  it('uses CORS_ALLOWED_ORIGINS exactly when set', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOWED_ORIGINS = 'https://web.example.test/, https://app.example.test';
    assert.deepEqual(allowedOrigins(), ['https://web.example.test', 'https://app.example.test']);
    assert.equal(isAllowedOrigin('https://web.example.test'), true);
    assert.equal(isAllowedOrigin('https://voxa.madfam.io'), false);
  });

  it('allows no sibling subdomain by wildcard in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ALLOWED_ORIGINS;
    assert.equal(isAllowedOrigin('https://voxa.madfam.io'), true);
    assert.equal(isAllowedOrigin('https://evil.madfam.io'), false);
    assert.equal(isAllowedOrigin('http://localhost:3000'), false);
  });

  it('allows local development origins outside production only', () => {
    process.env.NODE_ENV = 'test';
    assert.equal(isAllowedOrigin('http://localhost:3000'), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:3177'), true);
    assert.equal(isAllowedOrigin('http://localhost.evil.test:3000'), false);
  });

  it('answers a preflight from an allowed origin and not from another one', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOWED_ORIGINS = 'https://web.example.test';
    const ok = await app.request('/v1/boards', {
      method: 'OPTIONS',
      headers: { Origin: 'https://web.example.test', 'Access-Control-Request-Method': 'GET' },
    });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://web.example.test');
    const denied = await app.request('/v1/boards', {
      method: 'OPTIONS',
      headers: { Origin: 'https://other.madfam.io', 'Access-Control-Request-Method': 'GET' },
    });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  });
});
