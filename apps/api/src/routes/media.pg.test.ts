import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { DEMO_BOARD_ID } from '@voxa/core';
import app from '../app.js';
import { closeSharedDb, dbClientsCreatedForTests } from '../db/client.js';
import { initStore } from '../store/index.js';

/**
 * Runs against a real PostgreSQL when VOXA_TEST_DATABASE_URL is set (it runs
 * the migrations and writes rows there, so point it at a throwaway database).
 * Proves media uploads/reads and activation events reuse the API's single
 * database pool instead of opening one per request.
 */
const testDatabaseUrl = process.env.VOXA_TEST_DATABASE_URL?.trim();
const skip = testDatabaseUrl ? false : 'VOXA_TEST_DATABASE_URL is not set';

const EDITOR = { 'X-Voxa-User-Id': 'editor-1', 'X-Voxa-Role': 'editor' };
const READER = { 'X-Voxa-User-Id': 'user-1', 'X-Voxa-Role': 'communicator' };
const ROUNDS = 25;

describe('media and events on PostgreSQL share one database client', { skip }, () => {
  before(async () => {
    // Routes read DATABASE_URL per request; initStore opens the shared pool.
    process.env.DATABASE_URL = testDatabaseUrl;
    assert.equal(await initStore(), 'postgres');
  });

  after(async () => {
    await closeSharedDb();
  });

  it(`serves ${ROUNDS} uploads, reads and activations without opening another pool`, async () => {
    const clientsAfterInit = dbClientsCreatedForTests();

    for (let i = 0; i < ROUNDS; i += 1) {
      const payload = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, i]);
      const form = new FormData();
      form.set('boardId', DEMO_BOARD_ID);
      form.set('file', new File([payload], `clip-${i}.webm`, { type: 'audio/webm' }));

      const post = await app.request('/v1/media', { method: 'POST', headers: EDITOR, body: form });
      assert.equal(post.status, 201);
      const { id, sizeBytes } = (await post.json()) as { id: string; sizeBytes: number };
      assert.equal(sizeBytes, payload.byteLength);

      const get = await app.request(`/v1/media/${id}`, { headers: READER });
      assert.equal(get.status, 200);
      assert.equal(get.headers.get('Content-Type'), 'audio/webm');
      assert.deepEqual(new Uint8Array(await get.arrayBuffer()), payload);

      const activation = await app.request('/v1/events/activations', {
        method: 'POST',
        headers: { ...READER, 'Content-Type': 'application/json', 'X-Voxa-AI-Consent': 'true' },
        body: JSON.stringify({ boardId: DEMO_BOARD_ID, buttonId: 'want', speechText: 'want' }),
      });
      assert.equal(activation.status, 201);
    }

    const missing = await app.request('/v1/media/00000000-0000-0000-0000-000000000000', {
      headers: READER,
    });
    assert.equal(missing.status, 404);

    const summary = await app.request(
      `/v1/events/activations/summary?boardId=${DEMO_BOARD_ID}&days=7`,
      { headers: EDITOR },
    );
    assert.equal(summary.status, 200);
    const body = (await summary.json()) as { summary: { totalActivations: number } };
    assert.ok(body.summary.totalActivations >= ROUNDS);

    // initStore opened the shared pool (plus a short-lived migration client);
    // the request path must not have opened any more.
    assert.equal(dbClientsCreatedForTests(), clientsAfterInit);
  });
});
