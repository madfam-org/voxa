import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDemoBoard } from '@voxa/core';
import { exportBoardObfJson } from './local-obf-export.js';

describe('local-obf-export', () => {
  it('serializes the current board state to OBF JSON', () => {
    const board = createDemoBoard();
    const eat = board.grid.buttons.find((btn) => (btn.id as string) === 'eat');
    assert.ok(eat && eat.kind === 'analytic');
    eat.speechText = 'snack time';

    const json = exportBoardObfJson(board);
    assert.match(json, /demo-core/);
    assert.match(json, /snack time/);
    assert.match(json, /open-board-format/);
  });
});
