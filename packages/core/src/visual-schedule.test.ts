import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createVisualScheduleBoard,
  isVisualScheduleBoard,
  listScheduleSteps,
  scheduleProgress,
} from './visual-schedule.js';

describe('visual schedule boards', () => {
  it('creates a vertical daily routine with layout marker', () => {
    const board = createVisualScheduleBoard({ name: 'Morning' });
    assert.equal(board.layout, 'visual-schedule');
    assert.equal(board.name, 'Morning');
    assert.equal(board.grid.columns, 1);
    assert.ok(board.grid.rows >= 6);
    assert.equal(isVisualScheduleBoard(board), true);
  });

  it('orders steps by row and tracks progress', () => {
    const board = createVisualScheduleBoard();
    const steps = listScheduleSteps(board);
    assert.equal(steps.length, board.grid.buttons.length);
    assert.equal(steps[0]?.kind === 'analytic' ? steps[0].label : '', 'Wake up');
    assert.ok(steps.every((step, index) => step.position.row === index));

    const firstId = steps[0]?.id as string;
    const secondId = steps[1]?.id as string;
    const progress = scheduleProgress(new Set([firstId, secondId]), steps);
    assert.equal(progress.completed, 2);
    assert.equal(progress.total, steps.length);
    assert.equal(progress.currentStepId, steps[2]?.id as string);
  });
});
