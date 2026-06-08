import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import app from './app.js';
import { createFileBoardStore } from './store/file-board-store.js';
import { useTestStore } from './store/index.js';

describe('GET /health', () => {
  beforeEach(() => {
    useTestStore(createFileBoardStore());
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

  it('returns ready status for file-backed store', async () => {
    const res = await app.request('/health/ready');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; store: string; syncHub?: string };
    assert.equal(body.status, 'ready');
    assert.equal(body.store, 'file');
    assert.equal(body.syncHub, 'local');
  });
});
