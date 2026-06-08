import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSampleSnapArchive, snapArchiveToBoardUpdate } from './snap.js';

describe('TD Snap .spb import', () => {
  it('parses buttons from a minimal sqlite snap archive', async () => {
    const archive = await buildSampleSnapArchive();
    const { buttons, page, warnings } = await snapArchiveToBoardUpdate(archive, 'demo-core');
    assert.equal(page.cells.length, 3);
    assert.equal(buttons.length, 3);
    assert.equal(buttons[0]?.label, 'hello');
    assert.match(warnings.join(' '), /primary page/i);
  });
});
