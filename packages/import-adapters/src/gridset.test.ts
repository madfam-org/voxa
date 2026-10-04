import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { buildSampleGridsetArchive, gridsetArchiveToBoardUpdate, parseGridsetArchive } from './index.js';

describe('Grid 3 gridset import (beta, synthetic archives)', () => {
  it('imports the HOME grid named by Settings0/settings.xml, not the alphabetically first grid', () => {
    const archive = buildSampleGridsetArchive();
    const { pages, home, warnings } = parseGridsetArchive(archive);
    assert.equal(pages.length, 2);
    assert.equal(pages[0]!.name, 'Alphabet', 'Alphabet sorts first');
    assert.equal(home.name, 'Core');
    assert.equal(home.cells.length, 3);
    assert.equal(home.cells[0]!.label, 'hello');
    assert.match(warnings.join(' '), /home grid "Core" only/);
  });

  it('maps grid positions to board buttons with navigation', () => {
    const { buttons, page } = gridsetArchiveToBoardUpdate(buildSampleGridsetArchive());
    assert.equal(page.rows, 2);
    assert.equal(page.columns, 2);
    assert.equal(buttons.length, 3);
    assert.deepEqual(buttons[0]!.position, { row: 0, column: 0 });
    assert.equal(String(buttons[2]!.navigateToBoardId), 'core-more');
  });

  it('takes the locale from the gridset when present, else the fallback', () => {
    const withLanguage = gridsetArchiveToBoardUpdate(buildSampleGridsetArchive({ language: 'es_MX' }), {
      fallbackLocale: 'en-US',
    });
    assert.equal(withLanguage.locale, 'es-MX');
    assert.equal(withLanguage.buttons[0]!.locale, 'es-MX');
    const without = gridsetArchiveToBoardUpdate(buildSampleGridsetArchive(), { fallbackLocale: 'fr-FR' });
    assert.equal(without.locale, 'fr-FR');
  });

  it('falls back to the first grid with a warning when no start grid is named', () => {
    const { home, warnings } = parseGridsetArchive(buildSampleGridsetArchive({ startGrid: null }));
    assert.equal(home.name, 'Alphabet');
    assert.match(warnings.join(' '), /names no start grid/);
  });

  it('rejects unsafe archives (zip-slip)', () => {
    const evil = zipSync({ '../Grids/x/grid.xml': strToU8('<Grid/>') });
    assert.throws(() => parseGridsetArchive(evil), /unsafe path/);
  });
});
