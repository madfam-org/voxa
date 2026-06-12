import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  boardForDemoScene,
  createDemoAccessBoard,
  createDemoCoreBoard,
  DEMO_SCENE_META,
} from './demo-experience.js';

describe('demo experience boards', () => {
  it('lists four interactive demo scenes', () => {
    assert.equal(DEMO_SCENE_META.length, 4);
    assert.deepEqual(
      DEMO_SCENE_META.map((scene) => scene.id),
      ['communicate', 'literacy', 'schedule', 'access'],
    );
  });

  it('adds ARASAAC symbols to core demo words', () => {
    const board = createDemoCoreBoard();
    assert.equal(board.grid.rows, 6);
    const want = board.grid.buttons.find((button) => button.kind === 'analytic' && button.id === 'want');
    assert.ok(want && 'symbolUrl' in want && want.symbolUrl?.includes('5441'));
    const help = board.grid.buttons.find((button) => button.kind === 'analytic' && button.id === 'help');
    assert.ok(help && 'symbolUrl' in help && help.symbolUrl?.includes('4570'));
    const withSymbols = board.grid.buttons.filter(
      (button) => button.kind === 'analytic' && 'symbolUrl' in button && button.symbolUrl,
    );
    assert.equal(withSymbols.length, 47);
  });

  it('builds compact access preview grid', () => {
    const board = createDemoAccessBoard();
    assert.equal(board.grid.rows, 2);
    assert.equal(board.grid.columns, 2);
    assert.equal(board.grid.buttons.length, 4);
  });

  it('returns scene-specific boards', () => {
    assert.equal(boardForDemoScene('literacy').layout, 'literacy-keyboard');
    assert.equal(boardForDemoScene('schedule').layout, 'visual-schedule');
  });
});
