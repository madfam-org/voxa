import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import { createDemoBoard, type Board, type BoardButton } from '@voxa/core';
import { classifyImageUrl, voxaBoardToObf, voxaBoardToObz, type ObfBoard, type ObzImageLoader } from './index.js';

const LEGACY = 'https://static.arasaac.org/pictograms/6456/6456_300.png';
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function boardWith(...patches: Partial<BoardButton>[]): Board {
  const board = createDemoBoard();
  board.grid.buttons = board.grid.buttons.map((btn, index) => {
    const patch = patches[index];
    const base = { ...btn, symbolUrl: undefined, symbolRef: undefined } as BoardButton;
    return patch ? ({ ...base, ...patch } as BoardButton) : base;
  });
  return board;
}

function sortedIds(board: Board): string[] {
  return [...board.grid.buttons]
    .sort((a, b) => a.position.row - b.position.row || a.position.column - b.position.column)
    .map((btn) => btn.id as string);
}

describe('OBF/OBZ export images', () => {
  const realFetch = globalThis.fetch;
  let fetched: string[] = [];
  beforeEach(() => {
    fetched = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      fetched.push(String(input));
      throw new Error('export must not fetch');
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('classifies image URLs and refuses the removed library', () => {
    assert.equal(classifyImageUrl('/symbols/mulberry/EN/water.svg')?.kind, 'mulberry');
    assert.equal(classifyImageUrl('/symbols/mulberry/eat.svg')?.kind, 'mulberry');
    assert.equal(classifyImageUrl('data:image/png;base64,AAAA')?.kind, 'data');
    assert.equal(classifyImageUrl('https://voxa-api.example/v1/media/abc-123')?.kind, 'media');
    assert.equal(classifyImageUrl('https://images.example/x.png')?.kind, 'external');
    assert.equal(classifyImageUrl(LEGACY), undefined);
    assert.equal(classifyImageUrl('data:text/html;base64,AAAA'), undefined);
  });

  it('OBF: Mulberry images carry a licence; removed-library images are never emitted', () => {
    const ids = sortedIds(createDemoBoard());
    const board = boardWith(
      { symbolUrl: '/symbols/mulberry/EN/water.svg', symbolRef: { provider: 'mulberry', slug: 'water', file: 'EN/water.svg' } },
      { symbolUrl: LEGACY, symbolRef: { provider: 'arasaac', pictogramId: 6456 } },
      { symbolUrl: LEGACY },
    );
    const obf = voxaBoardToObf(board, { assetBaseUrl: 'https://voxa.example/' });
    const json = JSON.stringify(obf);
    assert.equal(json.includes('arasaac'), false);
    assert.equal(obf.images?.length, 1);
    const image = obf.images![0]!;
    assert.equal(image.url, 'https://voxa.example/symbols/mulberry/EN/water.svg');
    assert.equal(image.content_type, 'image/svg+xml');
    assert.deepEqual(image.license, {
      type: 'CC BY-SA 4.0',
      copyright_notice_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source_url: 'https://mulberrysymbols.org',
      author_name: 'Steve Lee',
      author_url: 'https://github.com/mulberrysymbols/mulberry-symbols',
    });
    const withImage = obf.buttons.filter((btn) => btn.image_id);
    assert.equal(withImage.length, 1);
    assert.equal(withImage[0]?.image_id, image.id);
    assert.ok(ids.includes(withImage[0]!.id));
  });

  it('OBZ: embeds Mulberry SVGs and user images with licence objects, never fetches', async () => {
    const board = boardWith(
      { symbolUrl: '/symbols/mulberry/EN/water.svg', symbolRef: { provider: 'mulberry', slug: 'water', file: 'EN/water.svg' } },
      { symbolUrl: '/symbols/mulberry/EN/water.svg' },
      { symbolUrl: `data:image/png;base64,${Buffer.from(PNG).toString('base64')}` },
      { symbolUrl: 'https://voxa-api.example/v1/media/photo-1' },
      { symbolUrl: LEGACY, symbolRef: { provider: 'arasaac', pictogramId: 6456 } },
      { symbolUrl: 'https://images.example/elsewhere.png' },
    );
    const requested: string[] = [];
    const loadImage: ObzImageLoader = async (source) => {
      requested.push(`${source.kind}:${source.mulberryPath ?? source.mediaId}`);
      if (source.kind === 'mulberry') return { bytes: SVG, contentType: 'image/svg+xml' };
      if (source.kind === 'media') return { bytes: PNG, contentType: 'image/png' };
      return null;
    };

    const files = unzipSync(await voxaBoardToObz(board, { loadImage, assetBaseUrl: 'https://voxa.example' }));
    const obf = JSON.parse(strFromU8(files['board.json']!)) as ObfBoard;

    assert.deepEqual(fetched, []);
    assert.deepEqual(requested.sort(), ['media:photo-1', 'mulberry:EN/water.svg']);
    assert.equal(strFromU8(files['board.json']!).includes('arasaac'), false);

    const mulberry = obf.images!.filter((image) => image.license);
    assert.equal(mulberry.length, 1, 'two buttons share one Mulberry image entry');
    assert.match(mulberry[0]!.path ?? '', /^images\/image-\d+\.svg$/);
    assert.deepEqual(files[mulberry[0]!.path!], SVG);
    assert.equal(mulberry[0]!.license?.type, 'CC BY-SA 4.0');
    assert.equal(mulberry[0]!.license?.author_name, 'Steve Lee');

    const embedded = Object.keys(files).filter((name) => name.startsWith('images/'));
    assert.equal(embedded.length, 3, embedded.join(','));
    assert.ok(embedded.every((name) => /\.(svg|png)$/.test(name)));

    const external = obf.images!.find((image) => image.url === 'https://images.example/elsewhere.png');
    assert.ok(external, 'third-party URL stays a reference');
    assert.equal(external.path, undefined);
  });

  it('OBZ round-trip restores embedded images on import', async () => {
    const { unpackObz, obzToVoxaButtons } = await import('./index.js');
    const board = boardWith({ symbolUrl: '/symbols/mulberry/EN/water.svg' });
    const archive = await voxaBoardToObz(board, {
      loadImage: async () => ({ bytes: SVG, contentType: 'image/svg+xml' }),
    });
    const buttons = obzToVoxaButtons(unpackObz(archive));
    const withImage = buttons.filter((btn) => btn.kind === 'analytic' && btn.symbolUrl);
    assert.equal(withImage.length, 1);
    const first = withImage[0]!;
    assert.match(first.kind === 'analytic' ? (first.symbolUrl ?? '') : '', /^data:image\/svg\+xml;base64,/);
  });
});
