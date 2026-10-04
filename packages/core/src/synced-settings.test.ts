import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseSyncedSettingsDocument,
  SYNCED_SETTING_KEYS,
  SYNCED_SETTINGS_MAX_BYTES,
  validateSyncedFields,
} from './synced-settings.js';

const AT = '2026-10-04T12:00:00.000Z';

describe('synced settings allow-list', () => {
  it('never lists device-specific fields', () => {
    for (const key of ['voiceURIByLocale', 'voiceMissingNoticeFor', 'uiLocale', 'defaultSymbolSkinTone']) {
      assert.equal((SYNCED_SETTING_KEYS as string[]).includes(key), false, key);
    }
    assert.ok(SYNCED_SETTING_KEYS.includes('switchIntervalMs'));
    assert.ok(SYNCED_SETTING_KEYS.includes('speechRate'));
  });

  it('accepts valid fields', () => {
    const result = validateSyncedFields({
      switchIntervalMs: { value: 1500, updatedAt: AT },
      accessMode: { value: 'switch', updatedAt: AT },
      touchGuardEnabled: { value: true, updatedAt: AT },
      switchGroupCycles: { value: 3, updatedAt: AT },
    });
    assert.equal(result.ok, true);
  });

  it('refuses unknown fields, bad values, extra keys and bad timestamps', () => {
    const problem = (input: unknown) => {
      const result = validateSyncedFields(input);
      return result.ok ? null : result.problem;
    };
    assert.deepEqual(problem({ voiceURIByLocale: { value: 'x', updatedAt: AT } }), {
      code: 'UNKNOWN_FIELD',
      field: 'voiceURIByLocale',
    });
    assert.deepEqual(problem({ __proto__x: { value: 1, updatedAt: AT } }), { code: 'UNKNOWN_FIELD', field: '__proto__x' });
    assert.equal(problem({ switchIntervalMs: { value: 10, updatedAt: AT } })?.code, 'INVALID_VALUE');
    assert.equal(problem({ switchIntervalMs: { value: '1500', updatedAt: AT } })?.code, 'INVALID_VALUE');
    assert.equal(problem({ switchGroupCycles: { value: 2.5, updatedAt: AT } })?.code, 'INVALID_VALUE');
    assert.equal(problem({ accessMode: { value: 'telepathy', updatedAt: AT } })?.code, 'INVALID_VALUE');
    assert.equal(problem({ hideLabels: { value: true, updatedAt: AT, extra: 1 } })?.code, 'INVALID_VALUE');
    assert.equal(problem({ hideLabels: { value: true, updatedAt: 'yesterday' } })?.code, 'INVALID_TIMESTAMP');
    assert.equal(problem([])?.code, 'NOT_AN_OBJECT');
    assert.equal(problem(null)?.code, 'NOT_AN_OBJECT');
  });

  it('keeps a full document far below the size ceiling', () => {
    const fields = Object.fromEntries(
      SYNCED_SETTING_KEYS.map((key) => [key, { value: 0, updatedAt: '2026-10-04T12:00:00.000000Z' }]),
    );
    assert.ok(JSON.stringify(fields).length < SYNCED_SETTINGS_MAX_BYTES / 2);
  });

  it('reads documents leniently: invalid entries dropped, malformed documents null', () => {
    const doc = parseSyncedSettingsDocument({
      version: 2,
      updatedAt: AT,
      fields: {
        switchIntervalMs: { value: 900, updatedAt: AT },
        voiceURIByLocale: { value: { 'es-MX': 'x' }, updatedAt: AT },
        eyeDwellMs: { value: 1, updatedAt: AT },
      },
    });
    assert.deepEqual(doc, { version: 2, updatedAt: AT, fields: { switchIntervalMs: { value: 900, updatedAt: AT } } });
    assert.equal(parseSyncedSettingsDocument(null), null);
    assert.equal(parseSyncedSettingsDocument('{}'), null);
    assert.equal(parseSyncedSettingsDocument({ version: -1, updatedAt: null, fields: {} }), null);
    assert.equal(parseSyncedSettingsDocument({ version: 1, updatedAt: null, fields: [] }), null);
  });
});
