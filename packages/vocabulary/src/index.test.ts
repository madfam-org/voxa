import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createButtonId } from '@voxa/core';
import { findMotorPlanningViolations } from './index.js';

describe('findMotorPlanningViolations', () => {
  it('flags moved locked buttons', () => {
    const id = createButtonId('core-go');
    const previous = [
      {
        id,
        kind: 'analytic' as const,
        label: 'go',
        speechText: 'go',
        locale: 'en-US',
        position: { row: 0, column: 0 },
        locked: true,
      },
    ];
    const next = [{ ...previous[0]!, position: { row: 0, column: 1 } }];

    const violations = findMotorPlanningViolations(previous, next);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.buttonId, 'core-go');
  });

  it('allows unlocked buttons to move', () => {
    const id = createButtonId('folder-cat');
    const previous = [
      {
        id,
        kind: 'analytic' as const,
        label: 'cat',
        speechText: 'cat',
        locale: 'en-US',
        position: { row: 1, column: 0 },
        locked: false,
      },
    ];
    const next = [{ ...previous[0]!, position: { row: 2, column: 0 } }];

    assert.equal(findMotorPlanningViolations(previous, next).length, 0);
  });
});
