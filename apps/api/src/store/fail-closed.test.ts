import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import app from '../app.js';
import { spawnApi } from '../test-support/api-process.js';
import { createFileBoardStore } from './file-board-store.js';
import { PRODUCTION_REQUIRES_DATABASE_MESSAGE, useTestStore } from './index.js';

describe('fail closed without a database in production (A-020)', () => {
  const savedNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
  });

  it('NODE_ENV=production without DATABASE_URL exits 1 with a clear message', async () => {
    const api = await spawnApi({ NODE_ENV: 'production', DATABASE_URL: undefined });
    const code = await Promise.race([
      api.exited,
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 20_000).unref()),
    ]);
    if (code === 'timeout') await api.stop();
    assert.equal(code, 1, api.output());
    assert.ok(api.output().includes(PRODUCTION_REQUIRES_DATABASE_MESSAGE), api.output());
  });

  it('/health/ready is not ready on the file store in production, and names the store', async () => {
    useTestStore(createFileBoardStore());
    process.env.NODE_ENV = 'production';
    const res = await app.request('/health/ready');
    assert.equal(res.status, 503);
    const body = (await res.json()) as { status: string; store: string; syncHub: string };
    assert.equal(body.status, 'unavailable');
    assert.equal(body.store, 'file');
    assert.equal(body.syncHub, 'local');
  });

  it('outside production the file store stays ready (local development)', async () => {
    useTestStore(createFileBoardStore());
    process.env.NODE_ENV = 'test';
    const res = await app.request('/health/ready');
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as { store: string }).store, 'file');
  });
});
