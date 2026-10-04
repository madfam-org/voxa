import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import app from '../app.js';
import { allowedMediaTypes, mediaQuotaBytes, resetFileMediaForTests } from '../lib/media-store.js';
import { mediaBytesMatchType, sniffableMediaTypes } from '../lib/media-sniff.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';
import { createOwnedBoard, devHeaders } from '../test-support/boards.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

function upload(boardId: string, userId: string, bytes: Uint8Array, name: string, type: string) {
  const form = new FormData();
  form.set('boardId', boardId);
  form.set('file', new File([new Uint8Array(bytes)], name, { type }));
  return app.request('/v1/media', { method: 'POST', headers: devHeaders(userId), body: form });
}

describe('media hardening (A-025)', () => {
  const savedQuota = process.env.MEDIA_QUOTA_BYTES_PER_USER;

  beforeEach(async () => {
    resetFileMediaForTests();
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    useTestStore(store);
  });

  afterEach(() => {
    if (savedQuota === undefined) delete process.env.MEDIA_QUOTA_BYTES_PER_USER;
    else process.env.MEDIA_QUOTA_BYTES_PER_USER = savedQuota;
  });

  it('HTML bytes labelled image/png → 415 MEDIA_TYPE_MISMATCH', async () => {
    await createOwnedBoard(app, 'owner-sniff', 'sniff-board');
    const html = new TextEncoder().encode('<!doctype html><script>alert(1)</script>');
    const res = await upload('sniff-board', 'owner-sniff', html, 'photo.png', 'image/png');
    assert.equal(res.status, 415);
    assert.equal(((await res.json()) as { code: string }).code, 'MEDIA_TYPE_MISMATCH');
  });

  it('a WAV labelled audio/mpeg → 415; the same bytes as audio/wav → 201', async () => {
    await createOwnedBoard(app, 'owner-wav', 'wav-board');
    const wav = new Uint8Array([
      ...new TextEncoder().encode('RIFF'),
      4,
      0,
      0,
      0,
      ...new TextEncoder().encode('WAVEfmt '),
    ]);
    assert.equal((await upload('wav-board', 'owner-wav', wav, 'a.mp3', 'audio/mpeg')).status, 415);
    assert.equal((await upload('wav-board', 'owner-wav', wav, 'a.wav', 'audio/wav')).status, 201);
  });

  it('media responses carry nosniff and an inline disposition', async () => {
    await createOwnedBoard(app, 'owner-headers', 'headers-board');
    const post = await upload('headers-board', 'owner-headers', PNG, 'p.png', 'image/png');
    assert.equal(post.status, 201);
    const { id } = (await post.json()) as { id: string };
    const get = await app.request(`/v1/media/${id}`, { headers: devHeaders('owner-headers') });
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(get.headers.get('Content-Disposition'), 'inline');
    assert.equal(get.headers.get('Content-Type'), 'image/png');
  });

  it('an upload past the per-user quota → 413 MEDIA_QUOTA_EXCEEDED', async () => {
    process.env.MEDIA_QUOTA_BYTES_PER_USER = String(PNG.byteLength * 2);
    await createOwnedBoard(app, 'owner-quota', 'quota-board');
    assert.equal(
      (await upload('quota-board', 'owner-quota', PNG, '1.png', 'image/png')).status,
      201,
    );
    assert.equal(
      (await upload('quota-board', 'owner-quota', PNG, '2.png', 'image/png')).status,
      201,
    );
    const third = await upload('quota-board', 'owner-quota', PNG, '3.png', 'image/png');
    assert.equal(third.status, 413);
    const body = (await third.json()) as { code: string; usedBytes: number; quotaBytes: number };
    assert.equal(body.code, 'MEDIA_QUOTA_EXCEEDED');
    assert.equal(body.usedBytes, PNG.byteLength * 2);
    assert.equal(body.quotaBytes, PNG.byteLength * 2);
    // The quota is per user: someone else still uploads.
    await createOwnedBoard(app, 'owner-quota-2', 'quota-board-2');
    assert.equal(
      (await upload('quota-board-2', 'owner-quota-2', PNG, '1.png', 'image/png')).status,
      201,
    );
  });

  it('a file over its type limit → 413 MEDIA_TOO_LARGE', async () => {
    await createOwnedBoard(app, 'owner-large', 'large-board');
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG);
    const res = await upload('large-board', 'owner-large', big, 'big.png', 'image/png');
    assert.equal(res.status, 413);
    assert.equal(((await res.json()) as { code: string }).code, 'MEDIA_TOO_LARGE');
  });

  it('the quota defaults to 500 MB and ignores malformed values', () => {
    assert.equal(mediaQuotaBytes(undefined), 500 * 1024 * 1024);
    assert.equal(mediaQuotaBytes('nope'), 500 * 1024 * 1024);
    assert.equal(mediaQuotaBytes('1048576'), 1048576);
  });

  it('the sniffing table covers exactly the accepted media types', () => {
    assert.deepEqual([...sniffableMediaTypes()].sort(), [...allowedMediaTypes()].sort());
  });

  it('recognises each accepted container', () => {
    const ascii = (text: string) => [...new TextEncoder().encode(text)];
    const cases: [string, number[]][] = [
      ['image/jpeg', [0xff, 0xd8, 0xff, 0xe0]],
      ['image/gif', ascii('GIF89a')],
      ['image/webp', [...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')]],
      ['audio/ogg', ascii('OggS')],
      ['audio/mpeg', ascii('ID3')],
      ['audio/mpeg', [0xff, 0xfb, 0x90]],
      ['audio/webm', [0x1a, 0x45, 0xdf, 0xa3]],
      ['video/webm', [0x1a, 0x45, 0xdf, 0xa3]],
      ['audio/mp4', [0, 0, 0, 0x20, ...ascii('ftypM4A ')]],
      ['video/mp4', [0, 0, 0, 0x20, ...ascii('ftypisom')]],
      ['video/quicktime', [0, 0, 0, 0x08, ...ascii('wide')]],
    ];
    for (const [type, bytes] of cases) {
      assert.ok(mediaBytesMatchType(new Uint8Array(bytes), type), type);
    }
    assert.equal(
      mediaBytesMatchType(new Uint8Array([0, 0, 0, 8, ...ascii('wide')]), 'video/mp4'),
      false,
    );
    assert.equal(mediaBytesMatchType(PNG, 'image/svg+xml'), false);
  });
});
