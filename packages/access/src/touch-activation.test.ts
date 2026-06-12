import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activatesOnPress,
  activatesOnRelease,
  DEFAULT_TOUCH_ACTIVATION,
} from './touch-activation.js';

describe('touch activation modes', () => {
  it('defaults to press (touch-start)', () => {
    assert.equal(DEFAULT_TOUCH_ACTIVATION, 'press');
    assert.equal(activatesOnPress('press'), true);
    assert.equal(activatesOnRelease('press'), false);
  });

  it('supports release (touch-up) activation', () => {
    assert.equal(activatesOnPress('release'), false);
    assert.equal(activatesOnRelease('release'), true);
  });
});
