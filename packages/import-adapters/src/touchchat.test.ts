import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSampleTouchChatArchive,
  parseTouchChatArchive,
  touchChatArchiveToBoardUpdate,
  touchChatCellsToBoardButtons,
} from './touchchat.js';

describe('TouchChat .ce import', () => {
  it('parses buttons from a minimal TouchChat zip archive', async () => {
    const archive = await buildSampleTouchChatArchive();
    const { page, warnings } = await parseTouchChatArchive(archive);
    assert.equal(page.name, 'Core');
    assert.equal(page.cells.length, 3);
    assert.equal(page.cells[0]?.label, 'hello');
    assert.ok(warnings.some((warning) => warning.includes('Home page')));
  });

  it('maps grid locations to board buttons', async () => {
    const archive = await buildSampleTouchChatArchive();
    const { page } = await parseTouchChatArchive(archive);
    const buttons = touchChatCellsToBoardButtons(page.cells);
    assert.equal(buttons.length, 3);
    assert.equal(buttons[0]?.kind, 'analytic');
    if (buttons[0]?.kind === 'analytic') {
      assert.equal(buttons[0].label, 'hello');
      assert.deepEqual(buttons[0].position, { row: 0, column: 0 });
    }
  });

  it('produces a board update payload', async () => {
    const archive = await buildSampleTouchChatArchive();
    const update = await touchChatArchiveToBoardUpdate(archive, 'board-test');
    assert.equal(update.page.rows, 2);
    assert.equal(update.page.columns, 2);
    assert.equal(update.buttons.length, 3);
  });
});
