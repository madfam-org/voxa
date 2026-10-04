import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import app from '../app.js';
import { resetFileMediaForTests } from '../lib/media-store.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';
import { createOwnedBoard, devHeaders } from '../test-support/boards.js';
import {
  MAX_IMPORT_ARCHIVE_BODY_BYTES,
  MAX_JSON_BODY_BYTES,
  MAX_MEDIA_UPLOAD_BODY_BYTES,
  maxBodyBytesFor,
} from './body-limit.js';

const MB = 1024 * 1024;

/**
 * A chunked body (no Content-Length) of `totalChunks` × 1 MB, produced lazily.
 * `pulled()` says how many chunks the server actually read.
 */
function lazyBody(totalChunks: number, firstChunk?: Uint8Array) {
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (pulled >= totalChunks) {
          controller.close();
          return;
        }
        controller.enqueue(pulled === 0 && firstChunk ? firstChunk : new Uint8Array(MB));
        pulled += 1;
      },
    },
    // No read-ahead: a chunk is produced only when someone reads.
    { highWaterMark: 0 },
  );
  return { stream, pulled: () => pulled };
}

describe('request body limits (A-016)', () => {
  beforeEach(async () => {
    resetFileMediaForTests();
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    useTestStore(store);
  });

  it('a 2 MB JSON body → 413 with a translatable code', async () => {
    await createOwnedBoard(app, 'owner-big', 'big-json');
    const res = await app.request('/v1/boards/big-json', {
      method: 'PUT',
      headers: { ...devHeaders('owner-big'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x'.repeat(2 * MB) }),
    });
    assert.equal(res.status, 413);
    const body = (await res.json()) as { code: string; maxBytes: number };
    assert.equal(body.code, 'PAYLOAD_TOO_LARGE');
    assert.equal(body.maxBytes, MAX_JSON_BODY_BYTES);
  });

  it('a chunked JSON body is cut off at the limit, not read to the end', async () => {
    const body = lazyBody(64);
    const res = await app.request('/v1/boards', {
      method: 'POST',
      headers: { ...devHeaders('owner-chunked'), 'Content-Type': 'application/json' },
      body: body.stream,
      // @ts-expect-error Node's fetch needs duplex for a stream body.
      duplex: 'half',
    });
    assert.equal(res.status, 413);
    assert.ok(body.pulled() <= 3, `read ${body.pulled()} MB of a 64 MB body`);
  });

  it('an oversized multipart upload → 413 without buffering the whole body', async () => {
    await createOwnedBoard(app, 'owner-upload', 'upload-board');
    const totalMb = 200;
    const head = new TextEncoder().encode(
      '--b\r\nContent-Disposition: form-data; name="boardId"\r\n\r\nupload-board\r\n' +
        '--b\r\nContent-Disposition: form-data; name="file"; filename="v.webm"\r\nContent-Type: video/webm\r\n\r\n',
    );
    const body = lazyBody(totalMb, head);
    const res = await app.request('/v1/media', {
      method: 'POST',
      headers: { ...devHeaders('owner-upload'), 'Content-Type': 'multipart/form-data; boundary=b' },
      body: body.stream,
      // @ts-expect-error Node's fetch needs duplex for a stream body.
      duplex: 'half',
    });
    assert.equal(res.status, 413);
    assert.equal(((await res.json()) as { code: string }).code, 'PAYLOAD_TOO_LARGE');
    const limitMb = Math.ceil(MAX_MEDIA_UPLOAD_BODY_BYTES / MB);
    assert.ok(
      body.pulled() <= limitMb + 2,
      `read ${body.pulled()} MB of a ${totalMb} MB upload (limit ${limitMb} MB)`,
    );
  });

  it('a declared Content-Length over the limit → 413 before any byte is read', async () => {
    const body = lazyBody(80);
    const res = await app.request('/v1/media', {
      method: 'POST',
      headers: {
        ...devHeaders('owner-cl'),
        'Content-Type': 'multipart/form-data; boundary=b',
        'Content-Length': String(80 * MB),
      },
      body: body.stream,
      // @ts-expect-error Node's fetch needs duplex for a stream body.
      duplex: 'half',
    });
    assert.equal(res.status, 413);
    assert.equal(body.pulled(), 0);
  });

  it('routes get their documented ceilings', () => {
    assert.equal(maxBodyBytesFor('POST', '/v1/media'), MAX_MEDIA_UPLOAD_BODY_BYTES);
    assert.equal(maxBodyBytesFor('POST', '/v1/boards/import/obz'), MAX_IMPORT_ARCHIVE_BODY_BYTES);
    assert.equal(maxBodyBytesFor('POST', '/v1/boards/import/touchchat'), MAX_IMPORT_ARCHIVE_BODY_BYTES);
    // The old in-place import path answers 410; it gets the JSON ceiling.
    assert.equal(maxBodyBytesFor('POST', '/v1/boards/b1/import/obz'), MAX_JSON_BODY_BYTES);
    assert.equal(maxBodyBytesFor('PUT', '/v1/boards/b1'), MAX_JSON_BODY_BYTES);
    assert.equal(maxBodyBytesFor('POST', '/v1/events/activations'), MAX_JSON_BODY_BYTES);
    // Never more than the media ceiling for a JSON route spelled like one.
    assert.equal(maxBodyBytesFor('PUT', '/v1/media'), MAX_JSON_BODY_BYTES);
  });
});
