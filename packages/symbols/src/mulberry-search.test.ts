import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MULBERRY_ASSET_BASE } from './mulberry.js';
import {
  MULBERRY_INDEX,
  MULBERRY_INDEX_META,
  normalizeKeyword,
  searchLanguage,
  searchMulberryIndex,
} from './mulberry-search.js';

const vendoredDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/web/public/symbols/mulberry',
);

describe('@voxa/symbols Mulberry keyword index', () => {
  it('indexes every vendored SVG exactly once, and only vendored files', () => {
    const vendored = readdirSync(path.join(vendoredDir, 'EN')).filter((name) => name.endsWith('.svg'));
    assert.equal(MULBERRY_INDEX.length, vendored.length);
    assert.equal(MULBERRY_INDEX_META.count, vendored.length);
    const files = new Set(MULBERRY_INDEX.map((entry) => entry.file));
    assert.equal(files.size, MULBERRY_INDEX.length);
    for (const entry of MULBERRY_INDEX) {
      assert.ok(existsSync(path.join(vendoredDir, entry.file)), entry.file);
      assert.ok(entry.en.length > 0, `${entry.slug} has no English keyword`);
    }
    const slugs = new Set(MULBERRY_INDEX.map((entry) => entry.slug));
    assert.equal(slugs.size, MULBERRY_INDEX.length);
  });

  it('ships hand-curated Spanish keywords for the core and common fringe', () => {
    assert.ok(MULBERRY_INDEX_META.spanishCount >= 300, `spanish=${MULBERRY_INDEX_META.spanishCount}`);
  });

  it('finds Spanish core words with the exact match first', () => {
    for (const [query, file] of [
      ['agua', 'EN/water.svg'],
      ['comer', 'EN/eat_,_to.svg'],
      ['ayuda', 'EN/help_,_to.svg'],
      ['baño', 'EN/toilets.svg'],
    ] as const) {
      const hits = searchMulberryIndex(query, { locale: 'es-MX' });
      assert.ok(hits.length > 0, query);
      assert.equal(hits[0]?.file, file, `${query} -> ${hits[0]?.file}`);
      assert.equal(hits[0]?.source, 'mulberry');
      assert.equal(hits[0]?.imageUrl, `${MULBERRY_ASSET_BASE}/${file}`);
    }
  });

  it('ignores accents and case', () => {
    assert.equal(searchMulberryIndex('BANO', { locale: 'es' })[0]?.file, 'EN/toilets.svg');
    assert.equal(normalizeKeyword('¿Qué?'), 'que');
  });

  it('ranks by the requested language and falls back to the others', () => {
    assert.equal(searchMulberryIndex('water', { locale: 'en' })[0]?.file, 'EN/water.svg');
    assert.equal(searchMulberryIndex('eau', { locale: 'fr' })[0]?.file, 'EN/water.svg');
    // An English query from a Spanish editor still finds the symbol.
    assert.equal(searchMulberryIndex('water', { locale: 'es' })[0]?.file, 'EN/water.svg');
    // The result title is in the requested language when the index has it.
    assert.equal(searchMulberryIndex('water', { locale: 'es' })[0]?.keyword, 'agua');
  });

  it('returns rated (anatomical) symbols only for an exact keyword', () => {
    assert.ok(searchMulberryIndex('body', { locale: 'en', limit: 24 }).every((hit) => hit.id !== 'male-body'));
    assert.equal(searchMulberryIndex('penis', { locale: 'en' })[0]?.id, 'penis');
  });

  it('bounds the limit and ignores short queries', () => {
    assert.deepEqual(searchMulberryIndex('a'), []);
    assert.equal(searchMulberryIndex('ca', { limit: 500 }).length <= 24, true);
    assert.equal(searchMulberryIndex('ca', { limit: 3 }).length, 3);
  });

  it('maps locales to a search language', () => {
    assert.equal(searchLanguage('es-MX'), 'es');
    assert.equal(searchLanguage('fr-FR'), 'fr');
    assert.equal(searchLanguage('en'), 'en');
    assert.equal(searchLanguage('de'), 'es');
    assert.equal(searchLanguage(undefined), 'es');
  });
});
