import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { createDemoBoard, type Board } from '@voxa/core';
import { obfSetToVoxaBoards, unpackObz, voxaBoardsToObz, voxaBoardToObz, type ObfImportOptions } from './index.js';

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures/obf');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cf00000301010018dd8db40000000049454e44ae426082', 'hex');

function options(extra: Partial<ObfImportOptions> = {}): ObfImportOptions {
  let n = 0;
  return { newBoardId: () => `new-${++n}`, ...extra };
}

function at(board: Board, row: number, column: number) {
  return board.grid.buttons.find((btn) => btn.position.row === row && btn.position.column === column);
}

describe('OBZ import', () => {
  it('spec-package.obz (manifest.json + boards/) imports every board of its manifest', async () => {
    const set = unpackObz(new Uint8Array(readFileSync(path.join(fixtures, 'spec-package.obz'))));
    assert.equal(set.boards.length, 1);
    assert.equal(set.rootId, 'spec-1');
    const result = await obfSetToVoxaBoards(set, options());
    assert.equal(result.boards.length, 1);
    assert.equal(result.rootBoardId, 'new-1');
    const agua = at(result.boards[0]!, 1, 1);
    assert.equal(agua?.kind === 'analytic' && agua.label, 'agua');
    const comida = at(result.boards[0]!, 0, 1);
    assert.equal(comida?.kind === 'analytic' && comida.label, 'comida');
    assert.equal(result.skipped.links, 1, 'boards/food.obf is not in the package: link removed and counted');
  });

  it('resolves in-package image paths and remaps load_board links across boards', async () => {
    const root = {
      format: 'open-board-0.1', id: 'root', locale: 'es', name: 'Inicio',
      grid: { rows: 1, columns: 2, order: [['b1', 'b2']] },
      buttons: [
        { id: 'b1', label: 'agua', image_id: 'img1' },
        { id: 'b2', label: 'comida', load_board: { id: 'food', path: 'boards/food.obf' } },
      ],
      images: [{ id: 'img1', path: 'images/agua.png', content_type: 'image/png', width: 1, height: 1 }],
      sounds: [],
    };
    const food = {
      format: 'open-board-0.1', id: 'food', locale: 'es', name: 'Comida',
      grid: { rows: 1, columns: 1, order: [['back']] },
      buttons: [{ id: 'back', label: 'volver', load_board: { id: 'root', path: 'boards/root.obf' } }],
      images: [], sounds: [],
    };
    const manifest = {
      format: 'open-board-0.1', root: 'boards/root.obf',
      paths: { boards: { root: 'boards/root.obf', food: 'boards/food.obf' }, images: { img1: 'images/agua.png' }, sounds: {} },
    };
    const archive = zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest)),
      'boards/root.obf': strToU8(JSON.stringify(root)),
      'boards/food.obf': strToU8(JSON.stringify(food)),
      'images/agua.png': new Uint8Array(PNG),
    });
    const result = await obfSetToVoxaBoards(unpackObz(archive), options());
    assert.equal(result.boards.length, 2);
    const [rootBoard, foodBoard] = result.boards;
    assert.match(at(rootBoard!, 0, 0)?.symbolUrl ?? '', /^data:image\/png;base64,/);
    assert.equal(at(rootBoard!, 0, 1)?.navigateToBoardId, foodBoard!.id);
    assert.equal(at(foodBoard!, 0, 0)?.navigateToBoardId, rootBoard!.id);
    assert.deepEqual(result.skipped, { images: 0, sounds: 0, links: 0, buttons: 0 });
  });

  it('still reads .obz packages of earlier Voxa versions (board.json, no manifest)', async () => {
    const set = unpackObz(new Uint8Array(readFileSync(path.join(fixtures, 'voxa-legacy-export.obz'))));
    const { boards } = await obfSetToVoxaBoards(set, options());
    assert.equal(boards[0]!.name, 'Soak test board');
  });
});

describe('OBZ export', () => {
  it('writes manifest.json, boards/<id>.obf and embedded media', async () => {
    const board = createDemoBoard();
    board.grid.buttons[0] = { ...board.grid.buttons[0]!, symbolUrl: `data:image/png;base64,${PNG.toString('base64')}`, symbolRef: undefined };
    const files = unzipSync(await voxaBoardToObz(board));
    const manifest = JSON.parse(strFromU8(files['manifest.json']!));
    assert.equal(manifest.format, 'open-board-0.1');
    assert.equal(manifest.root, 'boards/demo-core.obf');
    assert.deepEqual(manifest.paths.boards, { 'demo-core': 'boards/demo-core.obf' });
    const imagePaths = Object.values(manifest.paths.images) as string[];
    assert.equal(imagePaths.length, 1);
    assert.deepEqual(Buffer.from(files[imagePaths[0]!]!), PNG);
    assert.equal(files['board.json'], undefined);
  });

  it('export → import of a multi-board package keeps links between the boards', async () => {
    const home = createDemoBoard();
    const other: Board = { ...createDemoBoard(), id: 'other' as Board['id'], name: 'Other' };
    home.grid.buttons[0] = { ...home.grid.buttons[0]!, navigateToBoardId: 'other' as Board['id'] };
    const archive = await voxaBoardsToObz([home, other], 'demo-core');
    const files = unzipSync(archive);
    const homeObf = JSON.parse(strFromU8(files['boards/demo-core.obf']!));
    assert.deepEqual(homeObf.buttons.find((btn: { id: string }) => btn.id === home.grid.buttons[0]!.id).load_board, {
      id: 'other', name: 'Other', path: 'boards/other.obf',
    });
    const result = await obfSetToVoxaBoards(unpackObz(archive), options());
    assert.equal(result.rootBoardId, 'new-1');
    const first = result.boards[0]!.grid.buttons.find((btn) => btn.id === home.grid.buttons[0]!.id);
    assert.equal(first?.navigateToBoardId, 'new-2');
  });
});
