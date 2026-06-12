import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_GAMEPAD_BUTTONS,
  detectGamepadSwitchAction,
  handleHardwareSwitchKey,
} from './hardware-switch-adapter.js';

describe('HardwareSwitchAdapter', () => {
  it('routes keyboard codes to select/advance handlers', () => {
    const calls: string[] = [];
    handleHardwareSwitchKey('Space', {
      onSelect: () => calls.push('select'),
      onAdvance: () => calls.push('advance'),
    });
    handleHardwareSwitchKey('ArrowRight', {
      onSelect: () => calls.push('select'),
      onAdvance: () => calls.push('advance'),
    });
    assert.deepEqual(calls, ['select', 'advance']);
  });

  it('ignores unmapped keyboard codes', () => {
    let count = 0;
    const action = handleHardwareSwitchKey('KeyQ', {
      onSelect: () => {
        count += 1;
      },
      onAdvance: () => {
        count += 1;
      },
    });
    assert.equal(action, null);
    assert.equal(count, 0);
  });

  it('edge-detects gamepad select and advance buttons', () => {
    const pad = {
      buttons: [{ pressed: true }, { pressed: false }],
    };
    const first = detectGamepadSwitchAction([pad], new Map(), DEFAULT_GAMEPAD_BUTTONS);
    assert.equal(first.action, 'select');

    const second = detectGamepadSwitchAction([pad], first.nextPressed, DEFAULT_GAMEPAD_BUTTONS);
    assert.equal(second.action, null);

    const advancePad = {
      buttons: [{ pressed: true }, { pressed: true }],
    };
    const third = detectGamepadSwitchAction([advancePad], second.nextPressed, DEFAULT_GAMEPAD_BUTTONS);
    assert.equal(third.action, 'advance');
  });
});
