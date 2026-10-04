import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { MAX_MEDIA_BYTES } from '../lib/media-store.js';

/**
 * Request body ceilings (A-016). Hono's `bodyLimit` answers 413 from the
 * `Content-Length` header before reading anything; a body without one
 * (chunked) is read only up to the limit, then the request is refused. Either
 * way no handler ever buffers more than the ceiling.
 *
 * - JSON and other bodies: 1 MB (`MAX_JSON_BODY_BYTES`).
 * - `POST /v1/media`: the largest media type (video, 50 MB) plus 1 MB for the
 *   multipart framing and the other form fields. The per-type limits (image
 *   5 MB, audio 10 MB) are still checked after parsing.
 * - `POST /v1/boards/import/:format`: an outer ceiling of 50 MB plus 1 MB. The
 *   route itself refuses anything over its own `MAX_IMPORT_BYTES` (30 MB) with
 *   400 `ARCHIVE_TOO_LARGE`; this ceiling only stops bodies far past that.
 *   (`POST /v1/boards/:id/import/:format` answers 410 and gets the JSON limit.)
 * - `PUT /v1/me/settings`: 16 KB. The settings document is allow-listed and
 *   stays far below its own 8 KB ceiling (`SYNCED_SETTINGS_MAX_BYTES`).
 */
export const MAX_JSON_BODY_BYTES = 1024 * 1024;
const HEADROOM_BYTES = 1024 * 1024;
export const MAX_MEDIA_UPLOAD_BODY_BYTES = MAX_MEDIA_BYTES + HEADROOM_BYTES;
export const MAX_IMPORT_ARCHIVE_BYTES = 50 * 1024 * 1024;
export const MAX_IMPORT_ARCHIVE_BODY_BYTES = MAX_IMPORT_ARCHIVE_BYTES + HEADROOM_BYTES;
export const MAX_SETTINGS_BODY_BYTES = 16 * 1024;

/** Machine-readable code for clients to translate. */
export const PAYLOAD_TOO_LARGE_CODE = 'PAYLOAD_TOO_LARGE';

const IMPORT_PATH = /^\/v1\/boards\/import\/[^/]+\/?$/;
const MEDIA_UPLOAD_PATH = /^\/v1\/media\/?$/;
const SETTINGS_PATH = /^\/v1\/me\/settings\/?$/;

export function maxBodyBytesFor(method: string, path: string): number {
  if (method === 'POST') {
    if (MEDIA_UPLOAD_PATH.test(path)) return MAX_MEDIA_UPLOAD_BODY_BYTES;
    if (IMPORT_PATH.test(path)) return MAX_IMPORT_ARCHIVE_BODY_BYTES;
  }
  if (method === 'PUT' && SETTINGS_PATH.test(path)) return MAX_SETTINGS_BODY_BYTES;
  return MAX_JSON_BODY_BYTES;
}

function limiter(maxSize: number): MiddlewareHandler {
  return bodyLimit({
    maxSize,
    onError: (c: Context) =>
      c.json(
        { error: 'Request body too large', code: PAYLOAD_TOO_LARGE_CODE, maxBytes: maxSize },
        413,
      ),
  });
}

const limiters = new Map<number, MiddlewareHandler>(
  [
    MAX_JSON_BODY_BYTES,
    MAX_MEDIA_UPLOAD_BODY_BYTES,
    MAX_IMPORT_ARCHIVE_BODY_BYTES,
    MAX_SETTINGS_BODY_BYTES,
  ].map((size) => [
    size,
    limiter(size),
  ]),
);

/** Applies the ceiling for the request's route (see the table above). */
export function requestBodyLimits(): MiddlewareHandler {
  return (c, next) => {
    const max = maxBodyBytesFor(c.req.method, c.req.path);
    return limiters.get(max)!(c, next);
  };
}
