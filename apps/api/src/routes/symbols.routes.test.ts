import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import app from '../app.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';

describe('symbol routes', () => {
  beforeEach(async () => {
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    useTestStore(store);
  });

  it('requires editor role', async () => {
    const res = await app.request('/v1/symbols/search?q=eat', {
      headers: { 'X-Voxa-User-Id': 'user-1', 'X-Voxa-Role': 'communicator' },
    });
    assert.equal(res.status, 403);
  });

  it('returns empty for short queries', async () => {
    const res = await app.request('/v1/symbols/search?q=a', {
      headers: { 'X-Voxa-User-Id': 'user-1', 'X-Voxa-Role': 'editor' },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { symbols: unknown[]; attribution: string };
    assert.deepEqual(body.symbols, []);
    assert.match(body.attribution, /ARASAAC/);
  });
});
