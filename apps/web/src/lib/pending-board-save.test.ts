import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createDemoBoard } from '@voxa/core';
import { PENDING_SAVE_KEY } from './communicator-settings.js';

function createStorage(backing: Record<string, string>): Storage {
  return {
    get length() {
      return Object.keys(backing).length;
    },
    clear() {
      for (const key of Object.keys(backing)) delete backing[key];
    },
    getItem(key: string) {
      return backing[key] ?? null;
    },
    key(index: number) {
      return Object.keys(backing)[index] ?? null;
    },
    removeItem(key: string) {
      delete backing[key];
    },
    setItem(key: string, value: string) {
      backing[key] = value;
    },
  };
}

describe('pending-board-save', () => {
  let localBacking: Record<string, string>;

  beforeEach(() => {
    localBacking = {};
    (globalThis as typeof globalThis & { localStorage: Storage }).localStorage =
      createStorage(localBacking);
  });

  it('queues and loads a pending board save for the account that made it', async () => {
    const {
      clearPendingBoardSave,
      hasPendingBoardSave,
      loadPendingBoardSave,
      queuePendingBoardSaveSync,
    } = await import('./pending-board-save.js');

    const board = createDemoBoard();
    board.name = 'Pending soak board';

    queuePendingBoardSaveSync('demo-core', board, 'user-a');
    assert.equal(await hasPendingBoardSave('demo-core', 'user-a'), true);

    const loaded = await loadPendingBoardSave('demo-core', 'user-a');
    assert.equal(loaded.status, 'ready');
    assert.equal(loaded.status === 'ready' && loaded.board.name, 'Pending soak board');
    assert.equal(loaded.status === 'ready' && loaded.board.id, board.id);

    await clearPendingBoardSave('demo-core');
    assert.equal(await hasPendingBoardSave('demo-core', 'user-a'), false);
    assert.equal(localBacking[`${PENDING_SAVE_KEY}:demo-core`], undefined);
  });

  it('persists pending saves asynchronously', async () => {
    const { loadPendingBoardSave, queuePendingBoardSave } = await import('./pending-board-save.js');

    const board = createDemoBoard();
    board.version = 42;

    await queuePendingBoardSave('demo-core', board, 'user-a');
    const loaded = await loadPendingBoardSave('demo-core', 'user-a');
    assert.equal(loaded.status === 'ready' && loaded.board.version, 42);
  });

  it('never hands user A’s queued write to user B: it is deleted unsent', async () => {
    const { loadPendingBoardSave, queuePendingBoardSave } = await import('./pending-board-save.js');
    await queuePendingBoardSave('family-board', createDemoBoard(), 'user-a');

    assert.deepEqual(await loadPendingBoardSave('family-board', 'user-b'), { status: 'dropped' });
    assert.equal(localBacking[`${PENDING_SAVE_KEY}:family-board`], undefined);
    // Gone for user A too: nothing is replayed later under anyone.
    assert.deepEqual(await loadPendingBoardSave('family-board', 'user-a'), { status: 'none' });
  });

  it('drops a queued write when nobody is signed in', async () => {
    const { loadPendingBoardSave, queuePendingBoardSave } = await import('./pending-board-save.js');
    await queuePendingBoardSave('family-board', createDemoBoard(), 'user-a');
    assert.deepEqual(await loadPendingBoardSave('family-board', null), { status: 'dropped' });
  });

  it('drops a save queued before writes carried an owner', async () => {
    const { loadPendingBoardSave } = await import('./pending-board-save.js');
    localBacking[`${PENDING_SAVE_KEY}:family-board`] = JSON.stringify(createDemoBoard());
    assert.deepEqual(await loadPendingBoardSave('family-board', 'user-b'), { status: 'dropped' });
    assert.equal(localBacking[`${PENDING_SAVE_KEY}:family-board`], undefined);
  });

  it('keeps a queued write while it cannot tell who is signed in (offline)', async () => {
    const { loadPendingBoardSave, queuePendingBoardSave } = await import('./pending-board-save.js');
    await queuePendingBoardSave('family-board', createDemoBoard(), 'user-a');
    assert.deepEqual(await loadPendingBoardSave('family-board', undefined), { status: 'held' });
    const later = await loadPendingBoardSave('family-board', 'user-a');
    assert.equal(later.status, 'ready');
  });
});
