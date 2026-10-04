import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkVendoredSymbolSets, licenceHits } from './licence.mjs';

// Built at runtime so this file reads like the fixtures it describes.
const NAME = ['ARA', 'SAAC'].join('');

describe('licence guard (R86): removed symbol library', () => {
  it('fails on the name or a host in shipped code, catalogs, content and assets', () => {
    for (const [rel, text] of [
      ['apps/web/src/components/symbol-picker.tsx', `const url = 'https://api.${NAME.toLowerCase()}.org/v1';`],
      ['packages/i18n/messages/es.json', `{ "credit": "Pictogramas de ${NAME}" }`],
      ['apps/web/src/app/[locale]/page.tsx', `<p>Symbols by ${NAME}</p>`],
      ['docs/README-symbols.md', `We use ${NAME.toLowerCase()} pictograms.`],
      ['apps/web/public/symbols/mulberry/EN/cat.svg', `<svg><title>${NAME} cat</title></svg>`],
    ]) {
      assert.ok(licenceHits(rel, text).length > 0, `${rel} should fail`);
    }
  });

  it('fails on the name in a file path', () => {
    const hits = licenceHits(`apps/web/public/symbols/${NAME.toLowerCase()}/1.png`, null);
    assert.deepEqual(hits.map((h) => h.rule), ['removed-library-in-path']);
  });

  it('reports line numbers', () => {
    const hits = licenceHits('apps/api/src/x.ts', `a\nb\n// ${NAME}\n`);
    assert.deepEqual(hits, [{ rule: 'removed-library', line: 3 }]);
  });

  it('passes on the allowlist: history, legacy-data shim, guards and tests', () => {
    for (const rel of [
      'CHANGELOG.md',
      'packages/symbols/src/legacy.ts',
      'scripts/guards/licence.mjs',
      'apps/web/src/lib/crawling.test.ts',
      'e2e/specs/media-workflow.spec.ts',
    ]) {
      assert.deepEqual(licenceHits(rel, `mentions ${NAME}`), [], rel);
    }
  });

  it('passes on text without the name', () => {
    assert.deepEqual(licenceHits('apps/web/src/x.ts', 'Mulberry Symbols, CC BY-SA 4.0'), []);
  });
});

describe('licence guard: vendored symbol sets', () => {
  const NOTICE = 'Files: apps/web/public/symbols/mulberry/**';

  it('passes when the set has a licence file and a NOTICE entry', () => {
    const files = ['apps/web/public/symbols/mulberry/ATTRIBUTION.md', 'apps/web/public/symbols/mulberry/i.svg'];
    assert.deepEqual(checkVendoredSymbolSets(files, NOTICE), {
      sets: ['apps/web/public/symbols/mulberry'],
      problems: [],
    });
  });

  it('fails when a set has no licence file at its root', () => {
    const files = ['apps/web/public/symbols/newset/a.svg', 'apps/web/public/symbols/newset/sub/LICENSE.txt'];
    const { problems } = checkVendoredSymbolSets(files, 'apps/web/public/symbols/newset/');
    assert.equal(problems.length, 1);
    assert.match(problems[0], /no LICENSE/);
  });

  it('fails when a set has no NOTICE entry', () => {
    const files = ['apps/mobile/assets/symbols/newset/LICENSE', 'apps/mobile/assets/symbols/newset/a.svg'];
    const { problems } = checkVendoredSymbolSets(files, NOTICE);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /no entry in NOTICE/);
  });
});
