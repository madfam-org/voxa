import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { createBoardId, createDemoBoard } from '@voxa/core';
import { DrizzleQueryError } from 'drizzle-orm';
import app from '../app.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { getStore, useTestStore } from '../store/index.js';
import { errorMessage, unwrapDbError } from './db-errors.js';

const SECRET_PARAM = 'private words the user typed';

function wrappedDbError(): DrizzleQueryError {
  return new DrizzleQueryError(
    'insert into "sync_events" ("payload") values ($1)',
    [SECRET_PARAM],
    new Error('duplicate key value violates unique constraint "sync_events_pkey"'),
  );
}

describe('unwrapDbError', () => {
  it('returns the driver error, whose message carries no query parameters', () => {
    const wrapped = wrappedDbError();
    assert.ok(wrapped.message.includes(SECRET_PARAM), 'precondition: drizzle embeds params');

    const unwrapped = unwrapDbError(wrapped) as Error;
    assert.equal(unwrapped, wrapped.cause);
    assert.ok(!unwrapped.message.includes(SECRET_PARAM));
    assert.equal(errorMessage(wrapped), unwrapped.message);
  });

  it('falls back to a generic error when drizzle has no cause', () => {
    const unwrapped = unwrapDbError(new DrizzleQueryError('select 1', [SECRET_PARAM])) as Error;
    assert.equal(unwrapped.message, 'Database query failed');
  });

  it('leaves other errors untouched', () => {
    const plain = Object.assign(new Error('Board not found: x'), { status: 409 });
    assert.equal(unwrapDbError(plain), plain);
    assert.equal(errorMessage('text'), 'text');
  });
});

describe('API error paths with a wrapped database error', () => {
  let logged: unknown[][] = [];

  beforeEach(async () => {
    logged = [];
    mock.method(console, 'error', (...args: unknown[]) => {
      logged.push(args);
    });
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    useTestStore({
      ...store,
      listBoardsForActor: async () => {
        throw wrappedDbError();
      },
      updateBoard: async () => {
        throw wrappedDbError();
      },
    });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('an uncaught error answers 500 and logs the driver error only', async () => {
    const res = await app.request('/v1/boards');
    assert.equal(res.status, 500);
    assert.equal(await res.text(), 'Internal Server Error');
    assert.equal(logged.length, 1);
    const [loggedError] = logged[0] as [Error];
    assert.ok(!(loggedError instanceof DrizzleQueryError));
    assert.ok(!loggedError.message.includes(SECRET_PARAM));
  });

  it('a caught error does not echo query parameters to the client', async () => {
    const owner = { 'X-Voxa-User-Id': 'owner-1', 'X-Voxa-Role': 'communicator' };
    await getStore().createBoard({ ...createDemoBoard(), id: createBoardId('owned-board') }, 'owner-1');
    const current = await (await app.request('/v1/boards/owned-board', { headers: owner })).json();
    const res = await app.request('/v1/boards/owned-board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...owner },
      body: JSON.stringify(current),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, 'duplicate key value violates unique constraint "sync_events_pkey"');
    assert.ok(!JSON.stringify(body).includes(SECRET_PARAM));
  });
});
