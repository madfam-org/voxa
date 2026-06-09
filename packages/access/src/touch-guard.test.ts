import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isTouchGuardBlocker,
  isTouchGuardHole,
  touchGuardActive,
  touchGuardGridSize,
} from './touch-guard.js';

describe('touch guard overlay', () => {
  it('sizes the interleaved overlay grid', () => {
    assert.deepEqual(touchGuardGridSize(4, 6), { overlayRows: 7, overlayColumns: 11 });
    assert.deepEqual(touchGuardGridSize(1, 1), { overlayRows: 1, overlayColumns: 1 });
  });

  it('marks button slots as holes on even indices', () => {
    assert.equal(isTouchGuardHole(0, 0), true);
    assert.equal(isTouchGuardHole(0, 1), false);
    assert.equal(isTouchGuardHole(2, 4), true);
  });

  it('blocks interior gutters, perimeter, or both', () => {
    assert.equal(isTouchGuardBlocker(0, 1, 2, 2, 'gutter'), false);
    assert.equal(isTouchGuardBlocker(1, 1, 2, 2, 'gutter'), true);
    assert.equal(isTouchGuardBlocker(0, 0, 2, 2, 'perimeter'), false);
    assert.equal(isTouchGuardBlocker(0, 1, 2, 2, 'perimeter'), true);
    assert.equal(isTouchGuardBlocker(1, 1, 2, 2, 'both'), true);
    assert.equal(isTouchGuardBlocker(0, 0, 2, 2, 'both'), false);
  });

  it('detects active touch guard settings', () => {
    assert.equal(touchGuardActive({ enabled: false, mask: 'both' }), false);
    assert.equal(touchGuardActive({ enabled: true, mask: 'gutter' }), true);
  });
});
