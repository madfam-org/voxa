import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_COMMUNICATOR_SETTINGS, normalizeCommunicatorSettings } from './communicator-settings';

describe('communicator settings', () => {
  it('migrates the stored gaze bridge value to the event-bridge name', () => {
    assert.equal(normalizeCommunicatorSettings({ gazeSource: 'tobii-bridge' }).gazeSource, 'event-bridge');
    assert.equal(normalizeCommunicatorSettings({ gazeSource: 'event-bridge' }).gazeSource, 'event-bridge');
    assert.equal(normalizeCommunicatorSettings({ gazeSource: 'nonsense' }).gazeSource, 'pointer');
  });

  it('defaults the scan settings for profiles saved before they existed', () => {
    const s = normalizeCommunicatorSettings({ accessMode: 'switch', switchGroupStrategy: 'rows' });
    assert.equal(s.switchScanMode, 'auto');
    assert.equal(s.switchGroupCycles, 2);
    assert.equal(s.switchAcceptanceMs, 0);
    assert.equal(s.switchFirstItemHoldMs, 0);
    assert.equal(s.switchPostSelectionPauseMs, 0);
    assert.equal(s.switchGroupStrategy, 'rows');
  });

  it('keeps stored scan settings and clamps out-of-range values', () => {
    const s = normalizeCommunicatorSettings({
      switchScanMode: 'step',
      switchGroupCycles: 40,
      switchAcceptanceMs: -5,
      switchFirstItemHoldMs: 800,
      switchPostSelectionPauseMs: 99999,
    });
    assert.equal(s.switchScanMode, 'step');
    assert.equal(s.switchGroupCycles, 5);
    assert.equal(s.switchAcceptanceMs, 0);
    assert.equal(s.switchFirstItemHoldMs, 800);
    assert.equal(s.switchPostSelectionPauseMs, 3000);
  });

  it('keeps voice choices per locale and clamps speech tuning', () => {
    const s = normalizeCommunicatorSettings({
      voiceURIByLocale: { es_MX: 'uri:paulina', fr: 3 },
      speechRate: 5,
      speechPitch: 1.6,
      speechVolume: 'loud',
      voiceMissingNoticeFor: 7,
    });
    assert.deepEqual(s.voiceURIByLocale, { 'es-MX': 'uri:paulina' });
    assert.equal(s.speechRate, 2);
    assert.equal(s.speechPitch, 1.6);
    assert.equal(s.speechVolume, 1);
    assert.equal(s.voiceMissingNoticeFor, '');
    // Settings stored before voices existed keep working.
    const old = normalizeCommunicatorSettings({ cviTheme: 'classic-light' });
    assert.deepEqual(old.voiceURIByLocale, {});
    assert.equal(old.speechRate, 1);
  });

  it('falls back to the defaults for garbage', () => {
    assert.deepEqual(normalizeCommunicatorSettings(null), DEFAULT_COMMUNICATOR_SETTINGS);
    assert.deepEqual(normalizeCommunicatorSettings('x'), DEFAULT_COMMUNICATOR_SETTINGS);
  });
});
