import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  hasMulberrySymbol,
  isMulberryFile,
  MULBERRY_ASSET_BASE,
  MULBERRY_CORE_SLUGS,
  MULBERRY_OBF_LICENSE,
  mulberryFileUrl,
  mulberryImageUrl,
  mulberryPathFromUrl,
  resolveMulberrySymbolUrl,
} from './mulberry.js';
import { resolveButtonSymbolUrl, resolveSymbolRefUrl } from './resolve.js';

const publicDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/web/public',
);

describe('@voxa/symbols mulberry source', () => {
  it('builds local Mulberry SVG URLs for core slugs', () => {
    assert.equal(mulberryImageUrl('eat'), `${MULBERRY_ASSET_BASE}/eat.svg`);
    assert.equal(mulberryImageUrl('home'), `${MULBERRY_ASSET_BASE}/home.svg`);
    assert.equal(mulberryImageUrl('nonexistent-slug'), undefined);
    assert.equal(hasMulberrySymbol('eat'), true);
  });

  it('every core slug file is vendored', () => {
    for (const file of Object.values(MULBERRY_CORE_SLUGS)) {
      assert.ok(existsSync(path.join(publicDir, MULBERRY_ASSET_BASE, `${file}.svg`)), file);
    }
  });

  it('accepts only well-formed full-set files', () => {
    assert.equal(isMulberryFile('EN/want_,_to.svg'), true);
    assert.equal(mulberryFileUrl('EN/water.svg'), `${MULBERRY_ASSET_BASE}/EN/water.svg`);
    for (const bad of ['EN/../secret.svg', '../EN/water.svg', 'EN/water.png', 'https://x/EN/a.svg', 'EN/a b.svg']) {
      assert.equal(mulberryFileUrl(bad), undefined, bad);
    }
  });

  it('resolves refs: full-set file first, then core slug', () => {
    assert.equal(
      resolveMulberrySymbolUrl({ provider: 'mulberry', slug: 'water', file: 'EN/water.svg' }),
      `${MULBERRY_ASSET_BASE}/EN/water.svg`,
    );
    assert.equal(resolveMulberrySymbolUrl({ provider: 'mulberry', slug: 'go' }), `${MULBERRY_ASSET_BASE}/go.svg`);
    assert.equal(
      resolveMulberrySymbolUrl({ provider: 'mulberry', slug: 'go', file: 'EN/../x.svg' }),
      `${MULBERRY_ASSET_BASE}/go.svg`,
    );
    assert.equal(resolveSymbolRefUrl({ provider: 'mulberry', slug: 'drink' }), `${MULBERRY_ASSET_BASE}/drink.svg`);
  });

  it('prefers a mulberry symbolRef but falls back to the stored url when unresolved', () => {
    assert.equal(
      resolveButtonSymbolUrl('https://example.com/own.png', { provider: 'mulberry', slug: 'help' }),
      `${MULBERRY_ASSET_BASE}/help.svg`,
    );
    assert.equal(
      resolveButtonSymbolUrl('https://example.com/own.png', { provider: 'mulberry', slug: 'missing' }),
      'https://example.com/own.png',
    );
  });

  it('recognises vendored Mulberry URLs, relative or absolute', () => {
    assert.equal(mulberryPathFromUrl('/symbols/mulberry/EN/want_,_to.svg'), 'EN/want_,_to.svg');
    assert.equal(mulberryPathFromUrl('https://voxa.example/symbols/mulberry/EN/want_%2C_to.svg'), 'EN/want_,_to.svg');
    assert.equal(mulberryPathFromUrl('/symbols/mulberry/eat.svg'), 'eat.svg');
    assert.equal(mulberryPathFromUrl('/symbols/mulberry/nope.svg'), undefined);
    assert.equal(mulberryPathFromUrl('/symbols/mulberry/EN/../../x.svg'), undefined);
    assert.equal(mulberryPathFromUrl('/v1/media/abc'), undefined);
  });

  it('carries the OBF licence object for Mulberry images', () => {
    assert.equal(MULBERRY_OBF_LICENSE.type, 'CC BY-SA 4.0');
    assert.equal(MULBERRY_OBF_LICENSE.author_name, 'Steve Lee');
    assert.match(MULBERRY_OBF_LICENSE.copyright_notice_url, /creativecommons\.org\/licenses\/by-sa\/4\.0/);
    assert.match(MULBERRY_OBF_LICENSE.source_url, /mulberrysymbols\.org/);
  });
});
