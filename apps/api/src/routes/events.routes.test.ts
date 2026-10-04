import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_BOARD_ID } from '@voxa/core';
import app from '../app.js';
import { fileActivationsForTests, resetFileActivationsForTests } from '../lib/activations.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';
import { createOwnedBoard, devHeaders } from '../test-support/boards.js';
import { putConsents } from '../test-support/consents.js';

function postActivation(headers: Record<string, string>, body: Record<string, unknown>) {
  return app.request('/v1/events/activations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function summaryTotal(userId: string, boardId: string): Promise<number> {
  const res = await app.request(`/v1/events/activations/summary?boardId=${boardId}&days=7`, {
    headers: devHeaders(userId),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { summary: { totalActivations: number } };
  return body.summary.totalActivations;
}

describe('event routes', () => {
  beforeEach(async () => {
    resetFileActivationsForTests();
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    useTestStore(store);
  });

  it('stores nothing without a usage_analytics consent record, whatever the client header says', async () => {
    await createOwnedBoard(app, 'user-1', 'family-board');
    const res = await postActivation(
      { ...devHeaders('user-1'), 'X-Voxa-AI-Consent': 'true' },
      { boardId: 'family-board', buttonId: 'want', speechText: 'want' },
    );
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), {
      error: 'Usage analytics consent required',
      purpose: 'usage_analytics',
    });
    assert.deepEqual(fileActivationsForTests(), []);

    // ai_processing alone is a different purpose and does not allow logging.
    await putConsents(app, devHeaders('user-1'), { ai_processing: true });
    assert.equal(
      (await postActivation(devHeaders('user-1'), { boardId: 'family-board', buttonId: 'want' }))
        .status,
      403,
    );
    assert.deepEqual(fileActivationsForTests(), []);
  });

  it('records counts without any text under usage_analytics', async () => {
    await createOwnedBoard(app, 'user-1', 'family-board');
    await putConsents(app, devHeaders('user-1'), { usage_analytics: true });

    const post = await postActivation(devHeaders('user-1'), {
      boardId: 'family-board',
      buttonId: 'want',
      speechText: 'I want juice',
    });
    assert.equal(post.status, 201);
    assert.deepEqual(await post.json(), { ok: true, textStored: false });

    const stored = fileActivationsForTests();
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.buttonId, 'want');
    assert.equal(stored[0]?.speechText, undefined);
    assert.equal(await summaryTotal('user-1', 'family-board'), 1);
  });

  it('keeps no text under utterance_text when the organization is not on the DPA allow-list', async () => {
    await createOwnedBoard(app, 'user-1', 'family-board');
    await putConsents(app, devHeaders('user-1'), { usage_analytics: true, utterance_text: true });

    const post = await postActivation(devHeaders('user-1'), {
      boardId: 'family-board',
      buttonId: 'want',
      speechText: 'I want juice',
    });
    assert.equal(post.status, 201);
    assert.deepEqual(await post.json(), { ok: true, textStored: false });
    assert.equal(fileActivationsForTests()[0]?.speechText, undefined);
  });

  it('refuses activations on the shared demo board, even with consent', async () => {
    await putConsents(app, devHeaders('user-1'), { usage_analytics: true });
    const res = await postActivation(devHeaders('user-1'), {
      boardId: DEMO_BOARD_ID,
      buttonId: 'want',
    });
    assert.equal(res.status, 403);
    assert.deepEqual(fileActivationsForTests(), []);
  });

  it('shows usage reports only to people who may edit the board', async () => {
    await createOwnedBoard(app, 'user-1', 'family-board');
    const foreign = await app.request(
      '/v1/events/activations/summary?boardId=family-board&days=7',
      {
        headers: devHeaders('user-2', 'editor'),
      },
    );
    assert.equal(foreign.status, 403);

    const demo = await app.request(
      `/v1/events/activations/summary?boardId=${DEMO_BOARD_ID}&days=7`,
      {
        headers: devHeaders('user-2', 'editor'),
      },
    );
    assert.equal(demo.status, 403);
  });

  it('lets the board owner delete the board’s activation history, and nobody else', async () => {
    await createOwnedBoard(app, 'user-1', 'family-board');
    await createOwnedBoard(app, 'user-3', 'other-board');
    await putConsents(app, devHeaders('user-1'), { usage_analytics: true });
    await putConsents(app, devHeaders('user-3'), { usage_analytics: true });
    for (const buttonId of ['want', 'more']) {
      assert.equal(
        (await postActivation(devHeaders('user-1'), { boardId: 'family-board', buttonId })).status,
        201,
      );
    }
    assert.equal(
      (await postActivation(devHeaders('user-3'), { boardId: 'other-board', buttonId: 'go' }))
        .status,
      201,
    );

    const del = (
      userId: string,
      boardId: string,
      role: 'communicator' | 'editor' | 'admin' = 'communicator',
    ) =>
      app.request(`/v1/events/activations?boardId=${boardId}`, {
        method: 'DELETE',
        headers: devHeaders(userId, role),
      });

    assert.equal((await del('user-2', 'family-board')).status, 403);
    assert.equal((await del('user-2', 'family-board', 'admin')).status, 403);
    assert.equal((await del('user-1', DEMO_BOARD_ID)).status, 403);
    assert.equal((await del('user-1', 'missing-board')).status, 404);
    const missingId = await app.request('/v1/events/activations', {
      method: 'DELETE',
      headers: devHeaders('user-1'),
    });
    assert.equal(missingId.status, 400);
    assert.equal(await summaryTotal('user-1', 'family-board'), 2);

    const owner = await del('user-1', 'family-board');
    assert.equal(owner.status, 200);
    assert.deepEqual(await owner.json(), { ok: true, deleted: 2 });
    assert.equal(await summaryTotal('user-1', 'family-board'), 0);
    // Another board's history is untouched.
    assert.equal(await summaryTotal('user-3', 'other-board'), 1);
  });
});
