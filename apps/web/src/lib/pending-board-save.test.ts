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

  it('queues and loads a pending board save from localStorage', async () => {
    const {
      clearPendingBoardSave,
      hasPendingBoardSave,
      loadPendingBoardSave,
      queuePendingBoardSaveSync,
    } = await import('./pending-board-save.js');

    const board = createDemoBoard();
    board.name = 'Pending soak board';

    queuePendingBoardSaveSync('demo-core', board);
    assert.equal(await hasPendingBoardSave('demo-core'), true);

    const loaded = await loadPendingBoardSave('demo-core');
    assert.equal(loaded?.name, 'Pending soak board');
    assert.equal(loaded?.id, board.id);

    await clearPendingBoardSave('demo-core');
    assert.equal(await hasPendingBoardSave('demo-core'), false);
    assert.equal(localBacking[`${PENDING_SAVE_KEY}:demo-core`], undefined);
  });

  it('persists pending saves asynchronously', async () => {
    const { loadPendingBoardSave, queuePendingBoardSave } = await import('./pending-board-save.js');

    const board = createDemoBoard();
    board.version = 42;

    await queuePendingBoardSave('demo-core', board);
    const loaded = await loadPendingBoardSave('demo-core');
    assert.equal(loaded?.version, 42);
  });
});
