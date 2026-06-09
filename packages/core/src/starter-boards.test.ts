import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createStarterBoard, listStarterTemplates } from './starter-boards.js';

describe('starter board templates', () => {
  it('lists core-47 and core-100 templates', () => {
    const templates = listStarterTemplates();
    assert.equal(templates.length, 3);
    assert.equal(templates[0]?.id, 'core-47');
    assert.equal(templates[2]?.id, 'literacy-keyboard');
  });

  it('builds a 6x8 core-47 board with locked motor-plan slots', () => {
    const board = createStarterBoard('core-47');
    assert.equal(board.grid.rows, 6);
    assert.equal(board.grid.columns, 8);
    assert.equal(board.grid.buttons.length, 47);
    assert.ok(
      board.grid.buttons.some(
        (button) => button.locked && button.kind === 'analytic' && button.label === 'want',
      ),
    );
  });

  it('builds a 10x10 core-100 board', () => {
    const board = createStarterBoard('core-100', { boardId: 'my-core-100', name: 'Therapy core' });
    assert.equal(board.id, 'my-core-100');
    assert.equal(board.name, 'Therapy core');
    assert.equal(board.grid.buttons.length, 100);
  });

  it('builds a literacy keyboard template', () => {
    const board = createStarterBoard('literacy-keyboard', { name: 'Typing page' });
    assert.equal(board.layout, 'literacy-keyboard');
    assert.equal(board.name, 'Typing page');
    assert.equal(board.grid.rows, 4);
    assert.ok(board.grid.buttons.some((button) => button.kind === 'analytic' && button.label === 'Space'));
  });
});
