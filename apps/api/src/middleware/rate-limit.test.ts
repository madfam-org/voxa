import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import app from '../app.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';
import { devHeaders } from '../test-support/boards.js';
import {
  createRateLimiter,
  rateLimitBucketCountsForTests,
  resetRateLimitsForTests,
} from './rate-limit.js';

describe('rate limits (A-016)', () => {
  const saved = {
    ip: process.env.RATE_LIMIT_IP_PER_MINUTE,
    user: process.env.RATE_LIMIT_PER_MINUTE,
    devAuth: process.env.VOXA_DEV_AUTH,
  };

  beforeEach(() => {
    useTestStore(createFileBoardStore());
    resetRateLimitsForTests();
  });

  afterEach(() => {
    for (const [name, value] of [
      ['RATE_LIMIT_IP_PER_MINUTE', saved.ip],
      ['RATE_LIMIT_PER_MINUTE', saved.user],
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
    assert.deepEqual(rateLimitBucketCountsForTests(), { ip: 0, user: 0 });
  });
});
