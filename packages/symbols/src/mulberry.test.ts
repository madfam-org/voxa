import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasMulberrySymbol,
  MULBERRY_ASSET_BASE,
  MULBERRY_CORE_SLUGS,
  mulberryImageUrl,
  resolveMulberrySymbolUrl,
  searchMulberry,
} from './mulberry.js';
import { resolveButtonSymbolUrl, resolveSymbolRefUrl } from './arasaac-traits.js';

describe('@voxa/symbols mulberry source', () => {
  it('builds local Mulberry SVG URLs for known slugs', () => {
    assert.equal(mulberryImageUrl('eat'), `${MULBERRY_ASSET_BASE}/eat.svg`);
    assert.equal(mulberryImageUrl('home'), `${MULBERRY_ASSET_BASE}/home.svg`);
  });

  it('returns undefined for slugs without a vendored symbol', () => {
    assert.equal(mulberryImageUrl('nonexistent-slug'), undefined);
    assert.equal(hasMulberrySymbol('nonexistent-slug'), false);
    assert.equal(hasMulberrySymbol('eat'), true);
  });

  it('resolves a mulberry symbol reference to its local URL', () => {
    const url = resolveMulberrySymbolUrl({ provider: 'mulberry', slug: 'go' });
    assert.equal(url, `${MULBERRY_ASSET_BASE}/go.svg`);
  });

  it('dispatches resolveSymbolRefUrl on provider', () => {
    const arasaac = resolveSymbolRefUrl({ provider: 'arasaac', pictogramId: 6456 });
    assert.match(arasaac ?? '', /6456_300\.png$/);
    const mulberry = resolveSymbolRefUrl({ provider: 'mulberry', slug: 'drink' });
    assert.equal(mulberry, `${MULBERRY_ASSET_BASE}/drink.svg`);
  });

  it('prefers a mulberry symbolRef but falls back to legacy url when unresolved', () => {
    const resolved = resolveButtonSymbolUrl('https://example.com/legacy.png', {
      provider: 'mulberry',
      slug: 'help',
    });
    assert.equal(resolved, `${MULBERRY_ASSET_BASE}/help.svg`);

    const fallback = resolveButtonSymbolUrl('https://example.com/legacy.png', {
      provider: 'mulberry',
      slug: 'missing',
    });
    assert.equal(fallback, 'https://example.com/legacy.png');
  });

  it('searches the local Mulberry set by slug substring', () => {
    const hits = searchMulberry('oo', { limit: 5 });
    assert.ok(hits.length > 0);
    assert.ok(hits.every((hit) => hit.source === 'mulberry'));
    assert.ok(hits.some((hit) => hit.keyword === 'good' || hit.keyword === 'look'));
    assert.match(hits[0]?.imageUrl ?? '', /^\/symbols\/mulberry\/.+\.svg$/);
  });

  it('returns empty for short queries', () => {
    assert.deepEqual(searchMulberry('a'), []);
  });

  it('exposes a non-empty curated Core slug map', () => {
    assert.ok(Object.keys(MULBERRY_CORE_SLUGS).length >= 20);
  });
});
