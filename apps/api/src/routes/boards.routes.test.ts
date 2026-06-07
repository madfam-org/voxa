import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { createBoardId, createDemoBoard, DEMO_BOARD_ID } from '@voxa/core';
import app from '../app.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';

describe('board routes', () => {
  beforeEach(async () => {
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    useTestStore(store);
  });

  it('lists demo board without auth headers', async () => {
    const res = await app.request('/v1/boards');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { boards: Array<{ id: string }> };
    assert.ok(body.boards.some((board) => board.id === DEMO_BOARD_ID));
  });

  it('returns 404 for unknown board', async () => {
    const res = await app.request('/v1/boards/missing-board');
    assert.equal(res.status, 404);
  });

  it('hides private boards from other users', async () => {
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    const privateBoard = {
      ...createDemoBoard(),
      id: createBoardId('private-team'),
      name: 'Private',
      ownerUserId: 'owner-a',
    };
    await store.createBoard(privateBoard, 'owner-a');
    useTestStore(store);

    const res = await app.request('/v1/boards', {
      headers: { 'X-Voxa-User-Id': 'other-user', 'X-Voxa-Role': 'communicator' },
    });
    const body = (await res.json()) as { boards: Array<{ id: string }> };
    assert.ok(body.boards.some((board) => board.id === DEMO_BOARD_ID));
    assert.ok(!body.boards.some((board) => board.id === 'private-team'));
  });

  it('returns 403 when accessing a private board as another user', async () => {
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    const privateBoard = {
      ...createDemoBoard(),
      id: createBoardId('secret-board'),
      name: 'Secret',
      ownerUserId: 'owner-a',
    };
    await store.createBoard(privateBoard, 'owner-a');
    useTestStore(store);

    const res = await app.request('/v1/boards/secret-board', {
      headers: { 'X-Voxa-User-Id': 'intruder', 'X-Voxa-Role': 'communicator' },
    });
    assert.equal(res.status, 403);
  });

  it('requires editor role to update a board', async () => {
    const getRes = await app.request(`/v1/boards/${DEMO_BOARD_ID}`);
    const board = (await getRes.json()) as { name: string; version: number };

    const denied = await app.request(`/v1/boards/${DEMO_BOARD_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Voxa-Role': 'communicator',
      },
      body: JSON.stringify({ ...board, name: 'Blocked rename' }),
    });
    assert.equal(denied.status, 403);

    const allowed = await app.request(`/v1/boards/${DEMO_BOARD_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Voxa-Role': 'editor',
        'X-Voxa-User-Id': 'slp-1',
      },
      body: JSON.stringify({ ...board, name: 'Updated core', expectedVersion: board.version }),
    });
    assert.equal(allowed.status, 200);
    const updated = (await allowed.json()) as { board: { name: string; version: number } };
    assert.equal(updated.board.name, 'Updated core');
    assert.equal(updated.board.version, board.version + 1);
  });
});
