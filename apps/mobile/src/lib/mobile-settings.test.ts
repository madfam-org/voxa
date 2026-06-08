import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseMobileSettings } from './mobile-settings.js';

describe('mobile settings', () => {
  it('returns defaults when storage is empty', () => {
    const settings = parseMobileSettings(null);
    assert.equal(settings.accessMode, 'touch');
    assert.equal(settings.switchIntervalMs, 1200);
    assert.equal(settings.auditoryScanHighlight, true);
    assert.equal(settings.auditoryScanVoice, false);
  });

  it('merges persisted switch scan preferences', () => {
    const settings = parseMobileSettings(
      JSON.stringify({
        accessMode: 'switch',
        switchOrder: 'column-major',
        auditoryScanVoice: true,
      }),
    );
    assert.equal(settings.accessMode, 'switch');
    assert.equal(settings.switchOrder, 'column-major');
    assert.equal(settings.auditoryScanVoice, true);
    assert.equal(settings.switchIntervalMs, 1200);
  });

  it('falls back to defaults on invalid JSON', () => {
    const settings = parseMobileSettings('{not json');
    assert.equal(settings.accessMode, 'touch');
  });
});
