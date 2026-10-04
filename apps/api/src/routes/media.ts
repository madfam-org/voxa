import { Hono } from 'hono';
import { canAccessBoard, canEditBoard } from '../lib/board-access.js';
import {
  getMediaAsset,
  isAllowedMediaMime,
  MediaQuotaExceededError,
  MediaTooLargeError,
  saveMediaAsset,
} from '../lib/media-store.js';
import { mediaBytesMatchType } from '../lib/media-sniff.js';
import { getStore } from '../store/index.js';
import { errorMessage } from '../lib/db-errors.js';

export const mediaRoutes = new Hono();

function mediaPublicUrl(c: { req: { url: string } }, id: string): string {
  const url = new URL(c.req.url);
  return `${url.origin}/v1/media/${id}`;
}

// Upload rights follow board edit rights (owner, or an editor of the board's
// organization). The shared demo board accepts no uploads.
mediaRoutes.post('/', async (c) => {
  const body = await c.req.parseBody();
  const boardId = String(body.boardId ?? '');
  const file = body.file;

  if (!boardId) {
    return c.json({ error: 'boardId is required' }, 400);
  }

  if (!(file instanceof File)) {
    return c.json({ error: 'file is required' }, 400);
  }

  const mimeType = file.type || 'application/octet-stream';
  if (!isAllowedMediaMime(mimeType)) {
    return c.json({ error: `Unsupported media type: ${mimeType}` }, 415);
  }

  const { userId, role, orgId } = c.get('team');
  const board = await getStore().getBoard(boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, board.ownerUserId, userId, role, board.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // The declared type is client-asserted: the first bytes must agree (A-025).
  if (!mediaBytesMatchType(bytes, mimeType)) {
    return c.json(
      { error: `File content does not match ${mimeType}`, code: 'MEDIA_TYPE_MISMATCH' },
      415,
    );
  }

  try {
    const saved = await saveMediaAsset(process.env.DATABASE_URL, {
      boardId,
      ownerUserId: userId,
      mimeType,
      data: bytes,
    });

    return c.json(
      {
        id: saved.id,
        url: mediaPublicUrl(c, saved.id),
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
      },
      201,
    );
  } catch (err) {
    if (err instanceof MediaQuotaExceededError) {
      return c.json(
        { error: err.message, code: err.code, usedBytes: err.usedBytes, quotaBytes: err.quotaBytes },
        413,
      );
    }
    if (err instanceof MediaTooLargeError) {
      return c.json({ error: err.message, code: err.code, maxBytes: err.maxBytes }, 413);
    }
    return c.json({ error: errorMessage(err) }, 400);
  }
});

mediaRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const asset = await getMediaAsset(process.env.DATABASE_URL, id);
  if (!asset) return c.json({ error: 'Not found' }, 404);

  const { userId, role, orgId } = c.get('team');
  const board = await getStore().getBoard(asset.boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canAccessBoard(asset.boardId, board.ownerUserId, userId, role, board.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  return new Response(new Uint8Array(asset.data), {
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': String(asset.sizeBytes),
      'Cache-Control': 'private, max-age=86400',
      // Never let a browser second-guess the stored type, and never offer the
      // bytes as a download under a guessed name.
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
});
