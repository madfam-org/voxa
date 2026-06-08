import { Hono } from 'hono';
import { canAccessBoard, canEditBoard } from '../lib/board-access.js';
import { getMediaAsset, isAllowedMediaMime, saveMediaAsset } from '../lib/media-store.js';
import { requireEditor } from '../middleware/team-auth.js';
import { getStore } from '../store/index.js';

export const mediaRoutes = new Hono();

function mediaPublicUrl(c: { req: { url: string } }, id: string): string {
  const url = new URL(c.req.url);
  return `${url.origin}/v1/media/${id}`;
}

mediaRoutes.post('/', async (c) => {
  if (!requireEditor(c)) {
    return c.json({ error: 'Editor role required' }, 403);
  }

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
    return c.json({ error: (err as Error).message }, 400);
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
    },
  });
});
