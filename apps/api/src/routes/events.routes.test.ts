import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_BOARD_ID } from '@voxa/core';
import app from '../app.js';
import { resetFileActivationsForTests } from '../lib/activations.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';

describe('event routes', () => {
  beforeEach(async () => {
    resetFileActivationsForTests();
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    useTestStore(store);
  });

  it('rejects activation without consent header', async () => {
    const res = await app.request('/v1/events/activations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voxa-User-Id': 'user-1',
        'X-Voxa-Role': 'communicator',
      },
      body: JSON.stringify({ boardId: DEMO_BOARD_ID, buttonId: 'want' }),
    });
    assert.equal(res.status, 403);
  });

  it('records activation with consent', async () => {
    const post = await app.request('/v1/events/activations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voxa-User-Id': 'user-1',
        'X-Voxa-Role': 'communicator',
        'X-Voxa-AI-Consent': 'true',
      },
      body: JSON.stringify({
        boardId: DEMO_BOARD_ID,
        buttonId: 'want',
        speechText: 'want',
      }),
    });
    assert.equal(post.status, 201);

    const summary = await app.request(
      `/v1/events/activations/summary?boardId=${DEMO_BOARD_ID}&days=7`,
      {
        headers: {
          'X-Voxa-User-Id': 'user-1',
          'X-Voxa-Role': 'editor',
        },
      },
    );
    assert.equal(summary.status, 200);
    const body = (await summary.json()) as {
      summary: { totalActivations: number; byButton: Array<{ buttonId: string; count: number }> };
    };
    assert.equal(body.summary.totalActivations, 1);
    assert.equal(body.summary.byButton[0]?.buttonId, 'want');
  });
});
