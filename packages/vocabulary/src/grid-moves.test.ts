import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createButtonId, type BoardButton } from '@voxa/core';
import { createButtonAtCell, GridMoveError, moveButtonToCell } from './grid-moves.js';

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

describe('grid moves', () => {
  it('moves an unlocked button to an empty cell', () => {
    const buttons = [btn('a', 0, 0), btn('b', 0, 1)];
    const result = moveButtonToCell(buttons, 'a', 1, 1);
    assert.deepEqual(result.buttons.find((b) => (b.id as string) === 'a')?.position, { row: 1, column: 1 });
  });

  it('swaps two unlocked buttons', () => {
    const buttons = [btn('a', 0, 0), btn('b', 0, 1)];
    const result = moveButtonToCell(buttons, 'a', 0, 1);
    assert.equal(result.swappedWith, 'b');
    assert.deepEqual(result.buttons.find((b) => (b.id as string) === 'b')?.position, { row: 0, column: 0 });
  });

  it('blocks moving locked buttons without override', () => {
    const buttons = [btn('core', 0, 0, true)];
    assert.throws(() => moveButtonToCell(buttons, 'core', 1, 1), GridMoveError);
  });

  it('allows admin override for locked buttons', () => {
    const buttons = [btn('core', 0, 0, true)];
    const result = moveButtonToCell(buttons, 'core', 1, 1, { forceLocked: true });
    assert.deepEqual(result.buttons[0]?.position, { row: 1, column: 1 });
  });

  it('keeps locked core slots fixed when fringe buttons move', () => {
    const buttons = [
      btn('want', 0, 1, true),
      btn('eat', 1, 2, false),
      btn('drink', 1, 3, false),
    ];
    const result = moveButtonToCell(buttons, 'eat', 1, 3);
    const want = result.buttons.find((b) => (b.id as string) === 'want');
    const eat = result.buttons.find((b) => (b.id as string) === 'eat');
    assert.deepEqual(want?.position, { row: 0, column: 1 });
    assert.equal(want?.locked, true);
    assert.deepEqual(eat?.position, { row: 1, column: 3 });
  });

  it('creates a button in an empty cell', () => {
    const next = createButtonAtCell([btn('a', 0, 0)], 0, 1, 'new');
    assert.equal(next.length, 2);
    assert.equal(next[1]?.label, 'new');
  });
});
