import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EYE_DWELL_MAX_MS,
  EYE_DWELL_MIN_MS,
  GROUP_CYCLES_MAX,
  GROUP_CYCLES_MIN,
  SWITCH_INTERVAL_MAX_MS,
  SWITCH_INTERVAL_MIN_MS,
} from '@voxa/access';
import { isValidSyncedSettingValue, SYNCED_SETTING_KEYS, SYNCED_SETTING_RULES, validateSyncedFields } from '@voxa/core';
import { CVI_THEMES } from '@voxa/ui';
import {
  DEFAULT_COMMUNICATOR_SETTINGS,
  SCAN_ACCEPTANCE_MAX_MS,
  SCAN_FIRST_ITEM_HOLD_MAX_MS,
  SCAN_POST_SELECTION_PAUSE_MAX_MS,
  type CommunicatorSettings,
} from './communicator-settings';
import {
  buildPushFields,
  mergeSyncedSettings,
  NEVER_CHANGED,
  stampChangedFields,
  syncedValues,
} from './settings-sync';
import {
  SPEECH_PITCH_MAX,
  SPEECH_PITCH_MIN,
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  SPEECH_VOLUME_MAX,
  SPEECH_VOLUME_MIN,
} from './speech-voices';

const OLD = '2026-10-01T10:00:00.000Z';
const NEW = '2026-10-04T10:00:00.000Z';

const local: CommunicatorSettings = {
  ...DEFAULT_COMMUNICATOR_SETTINGS,
  switchIntervalMs: 1200,
  eyeDwellMs: 1000,
  voiceURIByLocale: { 'es-MX': 'device:paulina' },
};

function doc(fields: Record<string, { value: unknown; updatedAt: string }>, version = 3) {
  return { version, updatedAt: NEW, fields };
}

describe('settings sync merge rules', () => {
  it('the newer change wins, field by field', () => {
    const merged = mergeSyncedSettings(
      local,
      { switchIntervalMs: OLD, eyeDwellMs: NEW },
      doc({
        switchIntervalMs: { value: 2500, updatedAt: NEW }, // server newer: taken
        eyeDwellMs: { value: 2000, updatedAt: OLD }, // device newer: kept, push owed
      }),
    );
    assert.equal(merged.valid, true);
    assert.deepEqual(merged.patch, { switchIntervalMs: 2500 });
    assert.equal(merged.fieldTimes.switchIntervalMs, NEW);
    assert.equal(merged.fieldTimes.eyeDwellMs, NEW);
    assert.equal(merged.needsPush, true);
    assert.equal(merged.version, 3);
  });

  it('a field never changed on this device takes the server value', () => {
    const merged = mergeSyncedSettings(local, {}, doc({ hideLabels: { value: true, updatedAt: NEVER_CHANGED } }));
    assert.deepEqual(merged.patch, { hideLabels: true });
  });

  it('owes no push when the server already holds every change', () => {
    const times = Object.fromEntries(SYNCED_SETTING_KEYS.map((key) => [key, OLD]));
    const fields = Object.fromEntries(SYNCED_SETTING_KEYS.map((key) => [key, { value: local[key], updatedAt: OLD }]));
    const merged = mergeSyncedSettings(local, times, doc(fields));
    assert.deepEqual(merged.patch, {});
    assert.equal(merged.needsPush, false);
  });

  it('never syncs the voice choice: not sent, and a server copy of it is ignored', () => {
    const fields = buildPushFields(local, {});
    assert.equal('voiceURIByLocale' in fields, false);
    assert.equal('voiceMissingNoticeFor' in fields, false);
    assert.equal('uiLocale' in fields, false);
    assert.equal(JSON.stringify(fields).includes('device:paulina'), false);
    assert.equal(validateSyncedFields(fields).ok, true, 'what the device sends is what the API accepts');

    const merged = mergeSyncedSettings(
      local,
      {},
      doc({
        voiceURIByLocale: { value: { 'es-MX': 'other:voice' }, updatedAt: NEW },
        speechRate: { value: 1.4, updatedAt: NEW },
      }),
    );
    assert.deepEqual(merged.patch, { speechRate: 1.4 }, 'rate, pitch and volume do sync');
    assert.equal('voiceURIByLocale' in merged.patch, false);
  });

  it('ignores a malformed server document, and invalid entries in a valid one', () => {
    for (const bad of [null, 'oops', [], { version: 'x', fields: {} }, { version: 1, updatedAt: NEW, fields: 'x' }]) {
      const merged = mergeSyncedSettings(local, { switchIntervalMs: OLD }, bad);
      assert.equal(merged.valid, false);
      assert.deepEqual(merged.patch, {});
      assert.equal(merged.needsPush, false);
      assert.deepEqual(merged.fieldTimes, { switchIntervalMs: OLD });
    }
    const merged = mergeSyncedSettings(
      local,
      {},
      doc({
        switchIntervalMs: { value: 99, updatedAt: NEW }, // below the minimum
        accessMode: { value: 'mind-control', updatedAt: NEW },
        hideSymbols: { value: 'yes', updatedAt: NEW },
        cviTheme: { value: 'cvi-high-contrast', updatedAt: 'not a date' },
      }),
    );
    assert.equal(merged.valid, true);
    assert.deepEqual(merged.patch, {});
  });

  it('time-stamps only synced fields that changed', () => {
    const now = NEW;
    assert.equal(stampChangedFields(local, { ...local }, {}, now), null);
    assert.equal(stampChangedFields(local, { ...local, voiceURIByLocale: { 'es-MX': 'x' } }, {}, now), null);
    assert.deepEqual(stampChangedFields(local, { ...local, switchIntervalMs: 900 }, { eyeDwellMs: OLD }, now), {
      eyeDwellMs: OLD,
      switchIntervalMs: NEW,
    });
  });

  it('leaves a stored value outside the shared rules on the device', () => {
    const fields = buildPushFields({ ...local, targetScale: 9 }, {});
    assert.equal('targetScale' in fields, false);
    assert.equal(validateSyncedFields(fields).ok, true);
  });
});

describe('shared rules match the settings', () => {
  it('every synced key is a communicator setting, and the defaults are valid', () => {
    const values = syncedValues(DEFAULT_COMMUNICATOR_SETTINGS);
    for (const key of SYNCED_SETTING_KEYS) {
      assert.ok(key in DEFAULT_COMMUNICATOR_SETTINGS, key);
      assert.ok(isValidSyncedSettingValue(key, values[key]), `default ${key}`);
    }
  });

  it('ranges equal the settings UI bounds', () => {
    const range = (key: keyof typeof SYNCED_SETTING_RULES) => {
      const rule = SYNCED_SETTING_RULES[key] as { min: number; max: number };
      return [rule.min, rule.max];
    };
    assert.deepEqual(range('switchIntervalMs'), [SWITCH_INTERVAL_MIN_MS, SWITCH_INTERVAL_MAX_MS]);
    assert.deepEqual(range('eyeDwellMs'), [EYE_DWELL_MIN_MS, EYE_DWELL_MAX_MS]);
    assert.deepEqual(range('switchGroupCycles'), [GROUP_CYCLES_MIN, GROUP_CYCLES_MAX]);
    assert.deepEqual(range('switchFirstItemHoldMs'), [0, SCAN_FIRST_ITEM_HOLD_MAX_MS]);
    assert.deepEqual(range('switchAcceptanceMs'), [0, SCAN_ACCEPTANCE_MAX_MS]);
    assert.deepEqual(range('switchPostSelectionPauseMs'), [0, SCAN_POST_SELECTION_PAUSE_MAX_MS]);
    assert.deepEqual(range('speechRate'), [SPEECH_RATE_MIN, SPEECH_RATE_MAX]);
    assert.deepEqual(range('speechPitch'), [SPEECH_PITCH_MIN, SPEECH_PITCH_MAX]);
    assert.deepEqual(range('speechVolume'), [SPEECH_VOLUME_MIN, SPEECH_VOLUME_MAX]);
    const themes = (SYNCED_SETTING_RULES.cviTheme as { values: readonly string[] }).values;
    assert.deepEqual([...themes].sort(), Object.keys(CVI_THEMES).sort());
  });
});
