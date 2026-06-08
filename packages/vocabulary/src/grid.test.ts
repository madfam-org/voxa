import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createButtonId, type BoardButton } from '@voxa/core';
import { resizeBoardGrid, validateGridDimensions } from './grid.js';

function btn(id: string, row: number, col: number, locked = false): BoardButton {
  return {
    kind: 'analytic',
    id: createButtonId(id),
    label: id,
    speechText: id,
    locale: 'en-US',
    position: { row, column: col },
    locked,
  };
}

describe('grid resize', () => {
  it('rejects grids below 9 cells', () => {
    assert.ok(validateGridDimensions(2, 2));
    assert.equal(validateGridDimensions(3, 3), null);
  });

  it('preserves locked positions when shrinking within bounds', () => {
    const buttons = [btn('i', 0, 0, true), btn('go', 0, 1), btn('more', 1, 0)];
    const result = resizeBoardGrid(buttons, 3, 3);
    assert.equal(result.rows, 3);
    assert.equal(result.columns, 3);
    assert.equal(result.buttons.find((b) => (b.id as string) === 'i')?.position.row, 0);
  });

  it('reflows unlocked buttons when columns shrink', () => {
    const buttons = [
      btn('a', 0, 0),
      btn('b', 0, 1),
      btn('c', 0, 2),
      btn('d', 0, 3),
      btn('e', 1, 0),
      btn('f', 1, 1),
      btn('g', 1, 2),
      btn('h', 1, 3),
      btn('i', 2, 0),
    ];
    const result = resizeBoardGrid(buttons, 3, 3);
    assert.equal(result.buttons.length, 9);
    assert.ok(result.warnings.length > 0);
  });

  it('rejects shrink when locked button would fall outside grid', () => {
    const buttons: BoardButton[] = [btn('core', 3, 3, true)];
    for (let index = 0; index < 8; index += 1) {
      buttons.push(btn(`f${index}`, Math.floor(index / 3), index % 3));
    }
    assert.throws(() => resizeBoardGrid(buttons, 3, 3), /locked/i);
  });
});
