import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isRemovedSymbolRef, isRemovedSymbolUrl } from './legacy.js';
import { isSymbolUnavailable, resolveButtonSymbolUrl, resolveSymbolRefUrl } from './resolve.js';

const LEGACY_URL = 'https://static.arasaac.org/pictograms/6456/6456_300.png';

describe('legacy symbol references (removed library)', () => {
  it('recognises the removed library by host only', () => {
    assert.equal(isRemovedSymbolUrl(LEGACY_URL), true);
    assert.equal(isRemovedSymbolUrl('https://api.arasaac.org/v1/pictograms/1'), true);
    assert.equal(isRemovedSymbolUrl('https://arasaac.org.evil.example/x.png'), false);
    assert.equal(isRemovedSymbolUrl('/symbols/mulberry/EN/water.svg'), false);
    assert.equal(isRemovedSymbolUrl('data:image/png;base64,AAAA'), false);
    assert.equal(isRemovedSymbolUrl(undefined), false);
    assert.equal(isRemovedSymbolRef({ provider: 'arasaac', pictogramId: 6456 }), true);
    assert.equal(isRemovedSymbolRef({ provider: 'mulberry', slug: 'eat' }), false);
  });

  it('never renders a removed-library image: the cell is label-only', () => {
    assert.equal(resolveSymbolRefUrl({ provider: 'arasaac', pictogramId: 6456 }), undefined);
    assert.equal(resolveButtonSymbolUrl(LEGACY_URL, { provider: 'arasaac', pictogramId: 6456 }), undefined);
    assert.equal(resolveButtonSymbolUrl(LEGACY_URL, undefined), undefined);
    // A stale ref must not resurrect a removed URL either.
    assert.equal(resolveButtonSymbolUrl(LEGACY_URL, { provider: 'mulberry', slug: 'missing' }), undefined);
  });

  it('flags unavailable symbols so the editor can ask for a replacement', () => {
    assert.equal(isSymbolUnavailable(LEGACY_URL, undefined), true);
    assert.equal(isSymbolUnavailable(undefined, { provider: 'arasaac', pictogramId: 1 }), true);
    assert.equal(isSymbolUnavailable('/symbols/mulberry/eat.svg', { provider: 'mulberry', slug: 'eat' }), false);
    assert.equal(isSymbolUnavailable(undefined, undefined), false);
  });
});
