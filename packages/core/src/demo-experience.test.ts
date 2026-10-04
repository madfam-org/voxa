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

  it('adds allow-mapped Mulberry symbols to core demo words and leaves the rest label-only', () => {
    const board = createDemoCoreBoard();
    assert.equal(board.grid.rows, 6);
    const want = board.grid.buttons.find((button) => button.kind === 'analytic' && button.id === 'want');
    assert.equal(want?.symbolUrl, '/symbols/mulberry/want.svg');
    assert.deepEqual(want?.symbolRef, { provider: 'mulberry', slug: 'want' });
    const i = board.grid.buttons.find((button) => button.kind === 'analytic' && button.id === 'i');
    assert.ok(i && !i.symbolUrl && !i.symbolRef);
    const withSymbols = board.grid.buttons.filter((button) => button.symbolUrl);
    assert.equal(withSymbols.length, 23);
  });

  it('localizes the core demo board for es (Spanish labels, es-MX locale)', () => {
    const board = boardForDemoScene('communicate', 'es');
    assert.ok(board.grid.buttons.every((button) => button.locale === 'es-MX'));
    const i = board.grid.buttons.find((button) => button.id === 'i');
    assert.equal(i?.kind === 'analytic' ? i.label : undefined, 'yo');
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
