import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { strFromU8, unzipSync } from 'fflate';
import { createDemoBoard, createStarterBoard, type BoardButton } from '@voxa/core';
import { voxaBoardToObz, type ObfBoard } from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.resolve(here, '../schema');
const fixtures = path.resolve(here, '../../../fixtures/obf');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cf00000301010018dd8db40000000049454e44ae426082', 'hex');
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');

const ajv = new Ajv({ allErrors: true });
const validateBoard = ajv.compile(JSON.parse(readFileSync(path.join(schemaDir, 'obf-0.1.schema.json'), 'utf8')));
const validateManifest = ajv.compile(JSON.parse(readFileSync(path.join(schemaDir, 'obz-manifest-0.1.schema.json'), 'utf8')));

function assertValidBoard(board: unknown, files?: Record<string, Uint8Array>): void {
  assert.ok(validateBoard(board), JSON.stringify(validateBoard.errors, null, 2));
  // Cross-references JSON Schema cannot express.
  const obf = board as ObfBoard;
  assert.equal(obf.grid.order.length, obf.grid.rows);
  for (const row of obf.grid.order) assert.equal(row.length, obf.grid.columns);
  const buttonIds = new Set(obf.buttons.map((btn) => btn.id));
  assert.equal(buttonIds.size, obf.buttons.length, 'button ids are unique');
  for (const row of obf.grid.order) for (const id of row) if (id !== null) assert.ok(buttonIds.has(id), `order id ${id}`);
  const imageIds = new Set(obf.images.map((image) => image.id));
  const soundIds = new Set(obf.sounds.map((sound) => sound.id));
  for (const btn of obf.buttons) {
    if (btn.image_id) assert.ok(imageIds.has(btn.image_id), `image_id ${btn.image_id}`);
    if (btn.sound_id) assert.ok(soundIds.has(btn.sound_id), `sound_id ${btn.sound_id}`);
    if (files && btn.load_board?.path) assert.ok(files[btn.load_board.path], `load_board.path ${btn.load_board.path}`);
  }
  for (const entry of [...obf.images, ...obf.sounds]) {
    if (files && entry.path) assert.ok(files[entry.path], `path ${entry.path} is in the package`);
  }
}

describe('OBF 0.1 JSON Schema conformance', () => {
  it('the spec fixture validates (the schema accepts spec files)', () => {
    assertValidBoard(JSON.parse(readFileSync(path.join(fixtures, 'spec-board.obf'), 'utf8')));
  });

  it('the old Voxa dialect does not validate (the schema rejects the private format)', () => {
    assert.equal(validateBoard(JSON.parse(readFileSync(path.join(fixtures, 'voxa-legacy-export.obf'), 'utf8'))), false);
  });

  it('an exported .obz contains manifest.json and every board, image and sound validates', async () => {
    const board = createStarterBoard('core-47', { boardId: 'core', name: 'Núcleo', profileId: 'p', locale: 'es-MX' });
    const { symbolRef: _ref, ...first } = board.grid.buttons[0]! as BoardButton & { symbolRef?: unknown };
    board.grid.buttons[0] = { ...first, symbolUrl: `data:image/png;base64,${PNG.toString('base64')}` } as BoardButton;
    board.grid.buttons[1] = {
      ...board.grid.buttons[1]!,
      audio: { url: 'https://api.example/v1/media/rec-1', recordedBy: 'editor', durationMs: 900 },
      navigateToBoardId: 'core' as BoardButton['navigateToBoardId'],
    } as BoardButton;
    const archive = await voxaBoardToObz(board, {
      assetBaseUrl: 'https://voxa.example',
      loadImage: async (source) => (source.kind === 'mulberry' ? { bytes: SVG, contentType: 'image/svg+xml' } : null),
      loadSound: async () => ({ bytes: new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 0, 0]), contentType: 'audio/mpeg' }),
    });
    const files = unzipSync(archive);
    assert.ok(files['manifest.json'], 'manifest.json is present');
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    assert.ok(validateManifest(manifest), JSON.stringify(validateManifest.errors, null, 2));
    assert.ok(files[manifest.root], 'root is in the package');
    for (const [id, boardPath] of Object.entries(manifest.paths.boards as Record<string, string>)) {
      const obf = JSON.parse(strFromU8(files[boardPath]!));
      assert.equal(obf.id, id, 'manifest id matches the board id');
      assertValidBoard(obf, files);
      assert.ok(obf.sounds.length === 1 && obf.sounds[0].path, 'recording embedded as sounds[] with a path');
      assert.ok(obf.images.some((image: { license?: { type: string } }) => image.license?.type === 'CC BY-SA 4.0'));
    }
    for (const mediaPath of [...Object.values(manifest.paths.images), ...Object.values(manifest.paths.sounds)] as string[]) {
      assert.ok(files[mediaPath], `${mediaPath} is in the package`);
    }
  });

  it('a plain .obf export of the demo board validates', async () => {
    const { voxaBoardToObf } = await import('./index.js');
    assertValidBoard(JSON.parse(JSON.stringify(voxaBoardToObf(createDemoBoard()))));
  });
});
