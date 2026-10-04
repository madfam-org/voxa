import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExportImageSource } from '@voxa/obf';
import { createObzImageLoader } from './symbol-assets.js';
import type { MediaAssetRecord } from './media-store.js';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

function media(boardId: string, mimeType = 'image/png'): MediaAssetRecord {
  return {
    id: 'm1',
    boardId,
    ownerUserId: 'u1',
    mimeType,
    sizeBytes: 3,
    data: Buffer.from([1, 2, 3]),
    createdAt: new Date(0).toISOString(),
  };
}

describe('OBZ image loader', () => {
  it('loads Mulberry SVGs from the configured web origin only', async () => {
    const requested: string[] = [];
    const loader = createObzImageLoader('b1', {
      baseUrl: 'https://web.example/',
      fetchImpl: (async (url: string) => {
        requested.push(url);
        return new Response(SVG, { headers: { 'Content-Type': 'image/svg+xml' } });
      }) as unknown as typeof fetch,
      warn: () => {},
    });
    const source: ExportImageSource = {
      kind: 'mulberry',
      url: '/symbols/mulberry/EN/water.svg',
      mulberryPath: 'EN/water.svg',
    };
    const loaded = await loader(source);
    assert.deepEqual(requested, ['https://web.example/symbols/mulberry/EN/water.svg']);
    assert.equal(loaded?.contentType, 'image/svg+xml');
    assert.equal(new TextDecoder().decode(loaded?.bytes), SVG);
  });

  it('returns null (and warns) when the SVG is unavailable or not an SVG', async () => {
    const warnings: string[] = [];
    const loader = createObzImageLoader('b1', {
      baseUrl: 'https://web.example',
      fetchImpl: (async () => new Response('<html>', { status: 307, headers: { 'Content-Type': 'text/html' } })) as unknown as typeof fetch,
      warn: (message) => warnings.push(message),
    });
    assert.equal(await loader({ kind: 'mulberry', url: 'x', mulberryPath: 'EN/water.svg' }), null);
    assert.equal(warnings.length, 1);
  });

  it('embeds uploaded photos of the same board only', async () => {
    const loader = createObzImageLoader('b1', {
      getMedia: async (_db, id) => (id === 'same' ? media('b1') : id === 'other' ? media('b2') : media('b1', 'audio/webm')),
      fetchImpl: (async () => {
        throw new Error('must not fetch media over HTTP');
      }) as unknown as typeof fetch,
      warn: () => {},
    });
    assert.equal((await loader({ kind: 'media', url: 'u', mediaId: 'same' }))?.contentType, 'image/png');
    assert.equal(await loader({ kind: 'media', url: 'u', mediaId: 'other' }), null);
    assert.equal(await loader({ kind: 'media', url: 'u', mediaId: 'audio' }), null);
  });

  it('never loads external or inline sources', async () => {
    const loader = createObzImageLoader('b1', {
      fetchImpl: (async () => {
        throw new Error('must not fetch');
      }) as unknown as typeof fetch,
    });
    assert.equal(await loader({ kind: 'external', url: 'https://images.example/x.png' }), null);
  });
});
