import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDemoBoard } from '@voxa/core';
import { obfToVoxaButtons, parseObfJson, serializeObf, voxaBoardToObf } from './index.js';

describe('OBF interchange', () => {
  it('round-trips a Voxa board through OBF JSON', () => {
    const board = createDemoBoard();
    const obf = voxaBoardToObf(board);
    const json = serializeObf(obf);
    const { board: parsed } = parseObfJson(json);
    const buttons = obfToVoxaButtons(parsed);

    assert.equal(buttons.length, board.grid.buttons.length);
    assert.equal(parsed.name, board.name);
    assert.equal(parsed.grid.rows, board.grid.rows);
  });

  it('parses minimal OBF with warnings for missing format marker', () => {
    const minimal = JSON.stringify({
      id: 'test',
      name: 'Test',
      grid: { rows: 1, columns: 1, order: 'row-major' },
      buttons: [{ id: 'b1', label: 'hi', vocalization: 'hi' }],
    });

    const { warnings, board } = parseObfJson(minimal);
    assert.ok(warnings.length > 0);
    assert.equal(board.buttons[0]?.label, 'hi');
  });
});
