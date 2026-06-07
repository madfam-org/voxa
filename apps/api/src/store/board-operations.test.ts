import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createBoardId, createDemoBoard, DEMO_BOARD_ID } from '@voxa/core';
import { applyCreateBoard, applyUpdateBoard } from './board-operations.js';

describe('board operations', () => {
  it('creates a board and increments version on update', () => {
    const boards: Record<string, ReturnType<typeof createDemoBoard>> = {};
    const created = applyCreateBoard(boards, createDemoBoard(), 'editor-1');
    assert.equal(created.board.version, 1);

    const updated = applyUpdateBoard(
      boards,
      DEMO_BOARD_ID,
      { ...created.board, name: 'Renamed core' },
      'editor-1',
    );
    assert.equal(updated.board.name, 'Renamed core');
    assert.equal(updated.board.version, 2);
  });

  it('rejects version conflicts', () => {
    const boards: Record<string, ReturnType<typeof createDemoBoard>> = {};
    applyCreateBoard(boards, createDemoBoard(), 'editor-1');

    assert.throws(
      () =>
        applyUpdateBoard(
          boards,
          DEMO_BOARD_ID,
          { ...createDemoBoard(), name: 'Stale' },
          'editor-1',
          { expectedVersion: 99 },
        ),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 409);
        return true;
      },
    );
  });

  it('rejects motor planning violations unless forced', () => {
    const boards: Record<string, ReturnType<typeof createDemoBoard>> = {};
    const { board } = applyCreateBoard(boards, createDemoBoard(), 'editor-1');
    const locked = board.grid.buttons.find((b) => b.locked);
    assert.ok(locked);

    const moved = {
      ...board,
      grid: {
        ...board.grid,
        buttons: board.grid.buttons.map((button) =>
          button.id === locked!.id
            ? { ...button, position: { row: 99, column: 99 } }
            : button,
        ),
      },
    };

    assert.throws(
      () => applyUpdateBoard(boards, DEMO_BOARD_ID, moved, 'editor-1'),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 422);
        return true;
      },
    );

    const forced = applyUpdateBoard(boards, DEMO_BOARD_ID, moved, 'editor-1', {
      forceMotorPlanning: true,
    });
    assert.equal(forced.board.version, 2);
  });
});
