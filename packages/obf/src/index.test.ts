import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createDemoBoard, createStarterBoard, type Board, type BoardButton } from '@voxa/core';
import {
  obfSetFromJson,
  obfSetToVoxaBoards,
  parseObfJson,
  serializeObf,
  toObfColor,
  voxaBoardToObf,
  type ObfImportOptions,
} from './index.js';

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures/obf');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cf00000301010018dd8db40000000049454e44ae426082', 'hex');
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.from([36, 0, 0, 0]), Buffer.from('WAVEfmt '), Buffer.alloc(24)]);

function importOptions(extra: Partial<ObfImportOptions> = {}): ObfImportOptions {
  let n = 0;
  return { newBoardId: () => `new-${++n}`, ...extra };
}

function at(board: Board, row: number, column: number): BoardButton | undefined {
  return board.grid.buttons.find((btn) => btn.position.row === row && btn.position.column === column);
}

function richBoard(): Board {
  const board = createStarterBoard('core-47', { boardId: 'rich', name: 'Núcleo', profileId: 'p1', locale: 'es-MX' });
  const [first, second, third, fourth] = board.grid.buttons;
  board.grid.buttons[0] = {
    ...first!,
    kind: 'analytic',
    label: 'comer',
    speechText: 'quiero comer',
    locked: true,
    partOfSpeech: 'verb',
    speechForms: [{ id: 'past', label: 'comí', speechText: 'comí' }],
    activeSpeechFormId: 'past',
    audio: { url: `data:audio/wav;base64,${WAV.toString('base64')}`, recordedBy: 'editor-1', durationMs: 1200 },
    navigateToBoardId: 'food-board' as BoardButton['navigateToBoardId'],
  } as BoardButton;
  board.grid.buttons[1] = {
    kind: 'glp',
    id: second!.id,
    phrase: 'vamos al parque',
    locale: 'es-MX',
    position: second!.position,
    locked: false,
    intonationNotes: 'alegre',
    hidden: true,
  } as BoardButton;
  const { symbolRef: _replacedSymbol, ...photo } = third! as BoardButton & { symbolRef?: unknown };
  board.grid.buttons[2] = { ...photo, symbolUrl: `data:image/png;base64,${PNG.toString('base64')}`, locale: 'en-US' } as BoardButton;
  board.grid.buttons[3] = { ...fourth!, keyboardRole: 'char' } as BoardButton;
  board.layout = 'grid';
  board.display = { hideLabels: false };
  return board;
}

describe('OBF 0.1 export', () => {
  it('writes the spec shape: format, locale, 2-D order, images[], sounds[], load_board, rgb colours', () => {
    const obf = voxaBoardToObf(richBoard());
    assert.equal(obf.format, 'open-board-0.1');
    assert.equal(obf.locale, 'es-MX');
    assert.equal(obf.grid.order.length, obf.grid.rows);
    assert.ok(obf.grid.order.every((row) => row.length === obf.grid.columns));
    assert.ok(Array.isArray(obf.images) && Array.isArray(obf.sounds));
    const comer = obf.buttons.find((btn) => btn.label === 'comer')!;
    assert.deepEqual(comer.load_board, { id: 'food-board' });
    assert.equal('load_board_id' in comer, false);
    assert.match(comer.border_color!, /^rgb\(\d+, \d+, \d+\)$/);
    assert.ok(comer.sound_id && obf.sounds.some((sound) => sound.id === comer.sound_id));
    assert.equal(comer.ext_voxa_locked, true);
    const picture = obf.buttons.find((btn) => btn.image_id && obf.images.find((img) => img.id === btn.image_id)?.data);
    assert.ok(picture, 'data image is an images[] entry referenced by image_id');
    const ids = new Set(obf.buttons.map((btn) => btn.id));
    for (const row of obf.grid.order) for (const cell of row) if (cell !== null) assert.ok(ids.has(cell));
  });

  it('converts colours to rgb()', () => {
    assert.equal(toObfColor('#ea580c'), 'rgb(234, 88, 12)');
    assert.equal(toObfColor('#fff'), 'rgb(255, 255, 255)');
  });
});

describe('Voxa → OBF → Voxa round trip', () => {
  it('is identical, including ext_voxa_* data (locks, POS, GLP, word forms, keyboard roles, audio, layout)', async () => {
    const board = richBoard();
    const json = serializeObf(voxaBoardToObf(board));
    const result = await obfSetToVoxaBoards(obfSetFromJson(json), importOptions({ keepExternalLink: () => true }));
    const [imported] = result.boards;
    assert.ok(imported);
    assert.equal(imported.name, board.name);
    assert.equal(imported.layout, board.layout);
    assert.deepEqual(imported.display, board.display);
    assert.equal(imported.grid.rows, board.grid.rows);
    assert.equal(imported.grid.columns, board.grid.columns);
    const sort = (buttons: BoardButton[]) =>
      [...buttons].sort((a, b) => (a.id as string).localeCompare(b.id as string));
    assert.deepEqual(sort(imported.grid.buttons), sort(board.grid.buttons));
    assert.deepEqual(result.skipped, { images: 0, sounds: 0, links: 0, buttons: 0 });
  });

  it('round-trips the demo board with Mulberry symbols (absolute export URLs come back as the local path)', async () => {
    const board = createDemoBoard();
    const json = serializeObf(voxaBoardToObf(board, { assetBaseUrl: 'https://voxa.example' }));
    const { boards } = await obfSetToVoxaBoards(obfSetFromJson(json), importOptions());
    const sort = (buttons: BoardButton[]) =>
      [...buttons].sort((a, b) => (a.id as string).localeCompare(b.id as string));
    assert.deepEqual(sort(boards[0]!.grid.buttons), sort(board.grid.buttons));
  });
});

describe('OBF 0.1 import (spec files)', () => {
  const specBoard = readFileSync(path.join(fixtures, 'spec-board.obf'), 'utf8');

  it('spec-board.obf follows grid.order: comida at (0,1), más at (1,0), agua at (1,1) with its image, (0,0) empty', async () => {
    const { boards, skipped } = await obfSetToVoxaBoards(obfSetFromJson(specBoard), importOptions({ remoteMedia: 'keep' }));
    const board = boards[0]!;
    assert.equal(board.id, 'new-1');
    assert.equal(board.name, 'Spec board');
    assert.equal(at(board, 0, 0), undefined, 'order[0][0] is null');
    const agua = at(board, 1, 1);
    assert.equal(agua?.kind === 'analytic' && agua.label, 'agua');
    assert.equal(agua?.symbolUrl, 'https://example.org/agua.png', 'image_id resolves through images[]');
    const comida = at(board, 0, 1);
    assert.equal(comida?.kind === 'analytic' && comida.label, 'comida');
    const mas = at(board, 1, 0);
    assert.equal(mas?.kind === 'analytic' && mas.speechText, 'quiero más');
    assert.equal(agua?.locale, 'es');
    assert.equal(skipped.links, 1, 'food is not in this file: link removed and counted');
  });

  it('never stores a third-party image URL by default: the button imports without it and is counted', async () => {
    const { boards, skipped } = await obfSetToVoxaBoards(obfSetFromJson(specBoard), importOptions());
    const agua = at(boards[0]!, 1, 1);
    assert.equal(agua?.kind === 'analytic' && agua.label, 'agua');
    assert.equal(agua?.symbolUrl, undefined);
    assert.equal(skipped.images, 1);
  });

  it('embedded data: images go through storeMedia with a sniffed type', async () => {
    const doc = JSON.parse(specBoard);
    doc.images[0] = { id: 'img1', data: `data:image/png;base64,${PNG.toString('base64')}`, width: 1, height: 1, content_type: 'image/png' };
    const stored: string[] = [];
    const { boards, skipped } = await obfSetToVoxaBoards(
      obfSetFromJson(JSON.stringify(doc)),
      importOptions({
        storeMedia: async (media) => {
          stored.push(`${media.kind}:${media.contentType}:${media.boardId}`);
          return `https://api.example/v1/media/m-${stored.length}`;
        },
      }),
    );
    assert.deepEqual(stored, ['image:image/png:new-1']);
    assert.equal(at(boards[0]!, 1, 1)?.symbolUrl, 'https://api.example/v1/media/m-1');
    assert.equal(skipped.images, 0);
  });

  it('a link to a board in the same set is remapped to that board’s new id', async () => {
    const root = JSON.parse(specBoard);
    root.buttons[2].load_board = { id: 'food', name: 'Food' };
    const food = { format: 'open-board-0.1', id: 'food', locale: 'es', name: 'Comida', buttons: [], grid: { rows: 1, columns: 1, order: [[null]] }, images: [], sounds: [] };
    const set = obfSetFromJson(JSON.stringify(root));
    set.boards.push({ board: parseObfJson(JSON.stringify(food)).board, legacy: false });
    const { boards } = await obfSetToVoxaBoards(set, importOptions());
    assert.equal(boards[1]!.name, 'Comida');
    assert.equal(at(boards[0]!, 0, 1)?.navigateToBoardId, boards[1]!.id);
  });

  it('infers part of speech from an rgb() border colour', async () => {
    const doc = {
      format: 'open-board-0.1', id: 'pos', locale: 'en', name: 'POS',
      grid: { rows: 1, columns: 1, order: [['go']] },
      buttons: [{ id: 'go', label: 'go', border_color: toObfColor('#16a34a') }], images: [], sounds: [],
    };
    const { boards } = await obfSetToVoxaBoards(obfSetFromJson(JSON.stringify(doc)), importOptions());
    assert.equal(boards[0]!.grid.buttons[0]?.partOfSpeech, 'verb');
  });

  it('rejects documents that are not boards with an ObfImportError (HTTP 400)', () => {
    assert.throws(() => parseObfJson('not json'), (err: Error & { status?: number }) => err.status === 400);
    assert.throws(() => parseObfJson('{"format":"open-board-0.1"}'), /requires grid and buttons/);
    assert.throws(() => parseObfJson('{"grid":{"rows":0,"columns":1},"buttons":[]}'), /grid.rows/);
  });
});

describe('Legacy Voxa dialect import', () => {
  it('reads files earlier Voxa versions exported (row-major, load_board_id, URL image_id)', async () => {
    const legacy = readFileSync(path.join(fixtures, 'voxa-legacy-export.obf'), 'utf8');
    const parsed = parseObfJson(legacy);
    assert.equal(parsed.legacy, true);
    const { boards } = await obfSetToVoxaBoards(obfSetFromJson(legacy), importOptions());
    assert.equal(boards[0]!.name, 'Soak test board');
    assert.equal(at(boards[0]!, 0, 0)?.kind === 'analytic' && (at(boards[0]!, 0, 0) as { label: string }).label, 'hello');
    assert.equal(at(boards[0]!, 0, 1)?.kind === 'analytic' && (at(boards[0]!, 0, 1) as { speechText: string }).speechText, 'thank you');

    const withLink = {
      format: 'open-board-format', formatVersion: '3.0', id: 'old', name: 'Old',
      grid: { rows: 1, columns: 2, order: 'row-major' },
      buttons: [
        { id: 'a', label: 'water', image_id: '/symbols/mulberry/EN/water.svg' },
        { id: 'b', label: 'more', load_board_id: 'old' },
      ],
    };
    const result = await obfSetToVoxaBoards(obfSetFromJson(JSON.stringify(withLink)), importOptions());
    const board = result.boards[0]!;
    assert.equal(at(board, 0, 0)?.symbolUrl, '/symbols/mulberry/EN/water.svg');
    assert.equal(at(board, 0, 1)?.navigateToBoardId, board.id, 'self-link remapped to the new board');
  });
});
