import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSampleGridsetArchive,
  gridsetArchiveToBoardUpdate,
  parseGridsetArchive,
} from './index.js';

describe('Grid 3 gridset import', () => {
  it('parses cells from a minimal gridset zip', () => {
    const archive = buildSampleGridsetArchive();
    const { pages, warnings } = parseGridsetArchive(archive);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].name, 'Core');
    assert.equal(pages[0].cells.length, 3);
    assert.equal(pages[0].cells[0].label, 'hello');
    assert.equal(warnings.length, 0);
  });

  it('maps grid positions to board buttons with navigation', () => {
    const archive = buildSampleGridsetArchive();
    const { buttons, page } = gridsetArchiveToBoardUpdate(archive, 'demo-core');
    assert.equal(page.rows, 2);
    assert.equal(page.columns, 2);
    assert.equal(buttons.length, 3);
    assert.deepEqual(buttons[0].position, { row: 0, column: 0 });
    assert.equal(String(buttons[2].navigateToBoardId), 'core-more');
  });
});
