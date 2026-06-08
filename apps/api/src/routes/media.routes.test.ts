import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_BOARD_ID } from '@voxa/core';
import app from '../app.js';
import { resetFileMediaForTests } from '../lib/media-store.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';

describe('media routes', () => {
  beforeEach(async () => {
    resetFileMediaForTests();
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    useTestStore(store);
  });

  it('rejects upload without editor role', async () => {
    const form = new FormData();
    form.set('boardId', DEMO_BOARD_ID);
    form.set('file', new File([new Uint8Array([1, 2, 3])], 'test.webm', { type: 'audio/webm' }));

    const res = await app.request('/v1/media', {
      method: 'POST',
      headers: {
        'X-Voxa-User-Id': 'user-1',
        'X-Voxa-Role': 'communicator',
      },
      body: form,
    });
    assert.equal(res.status, 403);
  });

  it('uploads audio and serves it back', async () => {
    const payload = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
    const form = new FormData();
    form.set('boardId', DEMO_BOARD_ID);
    form.set('file', new File([payload], 'clip.webm', { type: 'audio/webm' }));

    const post = await app.request('/v1/media', {
      method: 'POST',
      headers: {
        'X-Voxa-User-Id': 'editor-1',
        'X-Voxa-Role': 'editor',
      },
      body: form,
    });
    assert.equal(post.status, 201);
    const body = (await post.json()) as { id: string; url: string; mimeType: string };
    assert.equal(body.mimeType, 'audio/webm');
    assert.ok(body.url.includes(body.id));

    const get = await app.request(`/v1/media/${body.id}`, {
      headers: {
        'X-Voxa-User-Id': 'user-1',
        'X-Voxa-Role': 'communicator',
      },
    });
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('Content-Type'), 'audio/webm');
    const bytes = new Uint8Array(await get.arrayBuffer());
    assert.deepEqual(bytes, payload);
  });

  it('uploads image symbols and serves them back', async () => {
    const payload = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const form = new FormData();
    form.set('boardId', DEMO_BOARD_ID);
    form.set('file', new File([payload], 'photo.png', { type: 'image/png' }));

    const post = await app.request('/v1/media', {
      method: 'POST',
      headers: {
        'X-Voxa-User-Id': 'editor-1',
        'X-Voxa-Role': 'editor',
      },
      body: form,
    });
    assert.equal(post.status, 201);
    const body = (await post.json()) as { id: string; mimeType: string };
    assert.equal(body.mimeType, 'image/png');

    const get = await app.request(`/v1/media/${body.id}`, {
      headers: {
        'X-Voxa-User-Id': 'user-1',
        'X-Voxa-Role': 'communicator',
      },
    });
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('Content-Type'), 'image/png');
  });
});
