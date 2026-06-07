import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Mirror client-side consent key logic
const CONSENT_KEY = 'voxa-ai-consent';

function parseConsent(raw: string | null): boolean {
  return raw === 'granted';
}

describe('AI consent', () => {
  it('treats granted as opt-in', () => {
    assert.equal(parseConsent('granted'), true);
  });

  it('treats denied or missing as opt-out', () => {
    assert.equal(parseConsent('denied'), false);
    assert.equal(parseConsent(null), false);
  });

  it('uses stable storage key', () => {
    assert.equal(CONSENT_KEY, 'voxa-ai-consent');
  });
});
