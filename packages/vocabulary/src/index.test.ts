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

  it('allows a button unlocked and moved in the same save', () => {
    const id = createButtonId('core-want');
    const previous = [
      {
        id,
        kind: 'analytic' as const,
        label: 'want',
        speechText: 'want',
        locale: 'en-US',
        position: { row: 0, column: 0 },
        locked: true,
      },
    ];
    const next = [{ ...previous[0]!, locked: false, position: { row: 0, column: 3 } }];
    assert.equal(findMotorPlanningViolations(previous, next).length, 0);
  });

  it('keeps the lock when the next body omits the field', () => {
    const id = createButtonId('core-more');
    const previous = [
      {
        id,
        kind: 'analytic' as const,
        label: 'more',
        speechText: 'more',
        locale: 'en-US',
        position: { row: 1, column: 1 },
        locked: true,
      },
    ];
    const { locked: _omitted, ...withoutLock } = previous[0]!;
    const next = [{ ...withoutLock, position: { row: 2, column: 1 } }] as unknown as typeof previous;
    assert.equal(findMotorPlanningViolations(previous, next).length, 1);
  });
});
