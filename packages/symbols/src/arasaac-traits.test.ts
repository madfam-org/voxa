import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ARASAAC_SKIN_TONE_OPTIONS,
  isPersonPictogram,
  resolveArasaacSymbolUrl,
  resolveButtonSymbolUrl,
} from './arasaac-traits.js';

describe('ARASAAC symbol traits', () => {
  it('detects person pictograms by tag', () => {
    assert.equal(isPersonPictogram(['verb', 'person']), true);
    assert.equal(isPersonPictogram(['food', 'drink']), false);
  });

  it('exposes inclusive skin tone labels', () => {
    assert.ok(ARASAAC_SKIN_TONE_OPTIONS.some((option) => option.label === 'Medium'));
  });

  it('resolves image URLs from symbol references', () => {
    const url = resolveArasaacSymbolUrl(
      { provider: 'arasaac', pictogramId: 6456, skinTone: 'aztec' },
      { skinTone: 'white' },
    );
    assert.match(url, /6456_300\.png$/);
  });

  it('prefers symbolRef over legacy symbolUrl', () => {
    const url = resolveButtonSymbolUrl(
      'https://example.com/legacy.png',
      { provider: 'arasaac', pictogramId: 1234 },
    );
    assert.match(url ?? '', /1234_300\.png$/);
  });
});
