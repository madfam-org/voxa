import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import app from '../app.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';
import { devHeaders } from '../test-support/boards.js';
import { startTestTokenIssuer, type TestTokenIssuer } from '../test-support/janua-tokens.js';
import {
  createRateLimiter,
  rateLimitBucketCountsForTests,
  resetRateLimitsForTests,
} from './rate-limit.js';

describe('rate limits (A-016)', () => {
  const saved = {
    ip: process.env.RATE_LIMIT_IP_PER_MINUTE,
    user: process.env.RATE_LIMIT_PER_MINUTE,
    media: process.env.RATE_LIMIT_MEDIA_PER_MINUTE,
    devAuth: process.env.VOXA_DEV_AUTH,
  };
  let issuer: TestTokenIssuer;

  before(async () => {
    issuer = await startTestTokenIssuer();
  });

  after(async () => {
    await issuer.close();
  });

  beforeEach(() => {
    useTestStore(createFileBoardStore());
    resetRateLimitsForTests();
  });

  afterEach(() => {
    for (const [name, value] of [
      ['RATE_LIMIT_IP_PER_MINUTE', saved.ip],
      ['RATE_LIMIT_PER_MINUTE', saved.user],
      ['RATE_LIMIT_MEDIA_PER_MINUTE', saved.media],
      ['VOXA_DEV_AUTH', saved.devAuth],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    resetRateLimitsForTests();
  });

  it('a spoofed X-Forwarded-For does not escape the address limit', async () => {
    // As in production: no development identity, so these are anonymous.
    process.env.VOXA_DEV_AUTH = 'false';
    process.env.RATE_LIMIT_IP_PER_MINUTE = '5';
    const statuses: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const res = await app.request('/v1/boards', {
        headers: {
          'CF-Connecting-IP': '203.0.113.7',
          // A fresh, client-written first hop on every request.
          'X-Forwarded-For': `198.51.100.${i}, 10.0.0.1`,
        },
      });
      statuses.push(res.status);
    }
    // Unauthenticated requests count too: 5 × 401, then 429.
    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429, 429, 429]);
  });

  it('keys anonymous traffic on CF-Connecting-IP, one bucket per address', async () => {
    process.env.VOXA_DEV_AUTH = 'false';
    process.env.RATE_LIMIT_IP_PER_MINUTE = '2';
    const hit = async (ip: string) =>
      (await app.request('/v1/boards', { headers: { 'CF-Connecting-IP': ip } })).status;
    assert.equal(await hit('203.0.113.1'), 401);
    assert.equal(await hit('203.0.113.1'), 401);
    assert.equal(await hit('203.0.113.1'), 429);
    assert.equal(await hit('203.0.113.2'), 401);
  });

  it('a signed-in user is limited by user id whatever address they use', async () => {
    process.env.RATE_LIMIT_PER_MINUTE = '3';
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await app.request('/v1/boards', {
        headers: { ...devHeaders('user-limited'), 'CF-Connecting-IP': `203.0.113.${10 + i}` },
      });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
    const other = await app.request('/v1/boards', {
      headers: { ...devHeaders('user-other'), 'CF-Connecting-IP': '203.0.113.10' },
    });
    assert.equal(other.status, 200);
    const limited = await app.request('/v1/boards', {
      headers: { ...devHeaders('user-limited'), 'CF-Connecting-IP': '203.0.113.99' },
    });
    assert.equal(limited.headers.get('Retry-After'), '60');
    assert.equal(((await limited.json()) as { code: string }).code, 'RATE_LIMITED');
  });

  it('expired buckets are pruned and the bucket count is bounded', () => {
    const limiter = createRateLimiter({ limit: () => 10, windowMs: 1_000, maxBuckets: 100 });
    for (let i = 0; i < 100; i += 1) limiter.hit(`ip:${i}`, 0);
    assert.equal(limiter.size(), 100);
    // At the cap with live buckets: the oldest is evicted, never more than 100.
    for (let i = 100; i < 150; i += 1) limiter.hit(`ip:${i}`, 500);
    assert.equal(limiter.size(), 100);
    // After the window everything is prunable.
    assert.equal(limiter.prune(2_000), 100);
    assert.equal(limiter.size(), 0);
  });

  it('the app limiters start empty in this process', () => {
    assert.deepEqual(rateLimitBucketCountsForTests(), {
      ip: 0,
      authFailures: 0,
      user: 0,
      media: 0,
    });
  });

  // The web server proxies browser calls to the API, so every user arrives
  // from the same address. Defaults only: no limit is raised for these tests.
  const PROXY = '198.51.100.200';

  it('5 users × 150 authenticated requests from one address (a proxy) get no 429', async () => {
    const statuses = new Map<number, number>();
    for (let user = 0; user < 5; user += 1) {
      const headers = {
        ...(await issuer.bearer({ sub: `proxied-${user}` })),
        'CF-Connecting-IP': PROXY,
      };
      for (let i = 0; i < 150; i += 1) {
        const res = await app.request('/v1/boards', { headers });
        statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
      }
    }
    assert.deepEqual([...statuses], [[200, 750]]);
    // Nothing was counted against the shared address.
    assert.equal(rateLimitBucketCountsForTests().ip, 0);
  });

  it('from one address the 61st bad-token request gets 429; a valid token still gets 200', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 61; i += 1) {
      const res = await app.request('/v1/boards', {
        headers: { Authorization: `Bearer not-a-jwt-${i}`, 'CF-Connecting-IP': PROXY },
      });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses.slice(0, 60), Array(60).fill(401));
    assert.equal(statuses[60], 429);
    // A session that verifies is never refused because of its address.
    const valid = await app.request('/v1/boards', {
      headers: {
        ...(await issuer.bearer({ sub: 'valid-behind-proxy' })),
        'CF-Connecting-IP': PROXY,
      },
    });
    assert.equal(valid.status, 200);
    // Another address is unaffected.
    const elsewhere = await app.request('/v1/boards', {
      headers: { Authorization: 'Bearer nope', 'CF-Connecting-IP': '198.51.100.201' },
    });
    assert.equal(elsewhere.status, 401);
  });

  it('one user reading 300 media items within the window gets no 429, and keeps the general budget', async () => {
    const auth = await issuer.bearer({ sub: 'media-reader' });
    const headers = { ...auth, 'CF-Connecting-IP': PROXY };
    const board = await app.request('/v1/boards', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: 'media-reader-board',
        name: 'Pictures',
        profileId: 'default',
        version: 1,
        updatedAt: new Date().toISOString(),
        grid: { rows: 1, columns: 1, buttons: [] },
      }),
    });
    assert.equal(board.status, 201);
    const form = new FormData();
    form.set('boardId', 'media-reader-board');
    form.set(
      'file',
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])], 'p.png', { type: 'image/png' }),
    );
    const Authorization = auth.Authorization ?? '';
    const upload = await app.request('/v1/media', {
      method: 'POST',
      headers: { Authorization, 'CF-Connecting-IP': PROXY },
      body: form,
    });
    assert.equal(upload.status, 201);
    const { id } = (await upload.json()) as { id: string };

    const statuses = new Map<number, number>();
    for (let i = 0; i < 300; i += 1) {
      const res = await app.request(`/v1/media/${id}`, { headers });
      statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
    }
    assert.deepEqual([...statuses], [[200, 300]]);
    assert.equal((await app.request('/v1/boards', { headers })).status, 200);
  });

  it('media reads have their own budget, separate from the general one', async () => {
    process.env.RATE_LIMIT_MEDIA_PER_MINUTE = '3';
    process.env.RATE_LIMIT_PER_MINUTE = '3';
    const headers = await issuer.bearer({ sub: 'budget-user' });
    const media = [];
    for (let i = 0; i < 4; i += 1)
      media.push((await app.request('/v1/media/does-not-exist', { headers })).status);
    // 404 three times (the read was allowed), then the media budget is spent.
    assert.deepEqual(media, [404, 404, 404, 429]);
    const general = [];
    for (let i = 0; i < 4; i += 1)
      general.push((await app.request('/v1/boards', { headers })).status);
    assert.deepEqual(general, [200, 200, 200, 429]);
  });
});
