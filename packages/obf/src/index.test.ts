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

  it('infers partOfSpeech from OBF border_color on import', () => {
    const { board: parsed } = parseObfJson(
      JSON.stringify({
        format: 'open-board-format',
        formatVersion: '3.0',
        id: 'pos-test',
        name: 'POS',
        grid: { rows: 1, columns: 1, order: 'row-major' },
        buttons: [{ id: 'go', label: 'go', border_color: '#16a34a' }],
      }),
    );
    const [button] = obfToVoxaButtons(parsed);
    assert.equal(button?.partOfSpeech, 'verb');
  });

  it('preserves OBF load_board_id as navigateToBoardId', () => {
    const board = createDemoBoard();
    const withLink = {
      ...board,
      grid: {
        ...board.grid,
        buttons: board.grid.buttons.map((btn, index) =>
          index === 0 ? { ...btn, navigateToBoardId: 'other-board' as typeof btn.navigateToBoardId } : btn,
        ),
      },
    };
    const obf = voxaBoardToObf(withLink);
    assert.equal(obf.buttons[0]?.load_board_id, 'other-board');

    const { board: parsed } = parseObfJson(serializeObf(obf));
    const buttons = obfToVoxaButtons(parsed);
    assert.equal(buttons[0]?.navigateToBoardId, 'other-board');
  });
});
