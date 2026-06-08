import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDemoBoard } from '@voxa/core';
import { packObz, serializeObf, unpackObz, voxaBoardToObf, voxaBoardToObz } from './index.js';

describe('OBZ bundles', () => {
  it('round-trips board.json and embedded images', async () => {
    const board = createDemoBoard();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    board.grid.buttons[0] = { ...board.grid.buttons[0]!, symbolUrl: `data:image/png;base64,${Buffer.from(png).toString('base64')}` };

    const archive = await voxaBoardToObz(board);
    const unpacked = unpackObz(archive);
    assert.equal(unpacked.board.name, board.name);
    assert.ok(unpacked.images.size >= 1);
    assert.ok([...unpacked.images.keys()].some((path) => path.startsWith('images/')));
  });

  it('packs and unpacks a minimal archive', () => {
    const obf = voxaBoardToObf(createDemoBoard());
    const imagePath = 'images/test.png';
    const imageBytes = new Uint8Array([1, 2, 3, 4]);
    const archive = packObz(serializeObf(obf), { [imagePath]: imageBytes });
    const { board, images } = unpackObz(archive);
    assert.equal(board.id, obf.id);
    assert.deepEqual(images.get(imagePath), imageBytes);
  });
});
