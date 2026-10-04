import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSampleGridsetArchive, buildSampleSnapArchive, buildSampleTouchChatArchive } from '@voxa/import-adapters';
import { planImport, type ImportContext } from './board-import.js';

function context(extra: Partial<ImportContext> = {}): ImportContext & { reserved: number[] } {
  const reserved: number[] = [];
  let n = 0;
  return {
    reserved,
    fallbackLocale: 'es-MX',
    reserve: (count) => {
      reserved.push(count);
    },
    storeMedia: async () => undefined,
    keepExternalLink: () => false,
    newBoardId: () => `new-${++n}`,
    ...extra,
  };
}

describe('planImport (beta one-page adapters)', () => {
  it('Grid 3: one NEW board from the home grid; links to other pages removed', async () => {
    const ctx = context();
    const plan = await planImport('gridset', buildSampleGridsetArchive(), ctx);
    assert.deepEqual(ctx.reserved, [1]);
    assert.equal(plan.beta, true);
    assert.equal(plan.boards.length, 1);
    assert.equal(plan.rootBoardId, 'new-1');
    assert.equal(plan.boards[0]!.name, 'Core');
    assert.equal(plan.boards[0]!.grid.buttons.length, 3);
    assert.ok(plan.boards[0]!.grid.buttons.every((btn) => btn.navigateToBoardId === undefined));
    assert.equal(plan.skipped.links, 1);
  });

  it('TD Snap and TouchChat: one NEW board each, in the fallback locale', async () => {
    const snap = await planImport('snap', await buildSampleSnapArchive(), context({ fallbackLocale: 'fr-FR' }));
    assert.equal(snap.boards[0]!.grid.buttons.length, 3);
    assert.equal(snap.boards[0]!.grid.buttons[0]!.locale, 'fr-FR');
    const touchChat = await planImport('touchchat', await buildSampleTouchChatArchive(), context());
    assert.equal(touchChat.boards[0]!.name, 'Core');
    assert.equal(touchChat.boards[0]!.grid.buttons.length, 3);
  });

  it('a board limit raised by reserve() stops the import before anything is stored', async () => {
    let stored = 0;
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    const doc = {
      format: 'open-board-0.1', id: 'x', locale: 'es', name: 'X',
      grid: { rows: 1, columns: 1, order: [['a']] },
      buttons: [{ id: 'a', label: 'a', image_id: 'i' }],
      images: [{ id: 'i', data: `data:image/png;base64,${png.toString('base64')}` }],
      sounds: [],
    };
    await assert.rejects(
      planImport('obf', new TextEncoder().encode(JSON.stringify(doc)), context({
        reserve: () => {
          throw new Error('limit');
        },
        storeMedia: async () => {
          stored += 1;
          return 'u';
        },
      })),
      /limit/,
    );
    assert.equal(stored, 0);
  });

  it('rejects files that are not what the format says with a 400-class error', async () => {
    await assert.rejects(planImport('gridset', new Uint8Array([1, 2, 3]), context()), (err: Error & { status?: number }) => err.status === 400);
    await assert.rejects(planImport('obf', new TextEncoder().encode('nope'), context()), (err: Error & { status?: number }) => err.status === 400);
  });
});
