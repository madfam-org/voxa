import assert from 'node:assert/strict';
import { describe, it, afterEach, beforeEach } from 'node:test';
import app from './app.js';
import { createFileBoardStore } from './store/file-board-store.js';
import { useTestStore } from './store/index.js';

describe('GET /health', () => {
  const savedSha = process.env.GIT_SHA;

  beforeEach(() => {
    useTestStore(createFileBoardStore());
  });

  afterEach(() => {
    if (savedSha === undefined) delete process.env.GIT_SHA;
    else process.env.GIT_SHA = savedSha;
  });

  it('returns service metadata for liveness probes', async () => {
    const res = await app.request('/health');

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      status: string;
      service: string;
      version: string;
      store: string;
    };
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'voxa-api');
    assert.match(body.version, /^\d+\.\d+\.\d+$/);
    assert.equal(body.store, 'file');
  });

  it('serves the build identity on liveness and readiness', async () => {
    const sha = '0123456789abcdef0123456789abcdef01234567';
    process.env.GIT_SHA = sha;
    for (const path of ['/health', '/health/ready']) {
      const res = await app.request(path);
      assert.equal(res.status, 200);
      const body = (await res.json()) as Record<string, unknown>;
      assert.equal(body.build, sha, path);
      assert.ok(!JSON.stringify(body).includes('GIT_SHA'), path);
    }
  });

  it('answers build "unknown" without a build identity', async () => {
    delete process.env.GIT_SHA;
    for (const path of ['/health', '/health/ready']) {
      const body = (await (await app.request(path)).json()) as { build: string };
      assert.equal(body.build, 'unknown', path);
    }
  });

  it('returns ready status for file-backed store', async () => {
    const res = await app.request('/health/ready');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; store: string; syncHub?: string };
    assert.equal(body.status, 'ready');
    assert.equal(body.store, 'file');
    assert.equal(body.syncHub, 'local');
  });
});
