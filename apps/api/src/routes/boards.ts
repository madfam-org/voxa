import { Hono } from 'hono';
import type { Board } from '@voxa/core';
import { canAccessBoard, canEditBoard } from '../lib/board-access.js';
import { maxBoardCount, resolveEntitlement } from '../lib/dhanam.js';
import { requireEditor } from '../middleware/team-auth.js';
import { getStore } from '../store/index.js';
import { broadcastBoardEvent } from '../ws/hub.js';

export const boardRoutes = new Hono();

boardRoutes.get('/', async (c) => {
  const { userId, role } = c.get('team');
  const all = await getStore().listBoards();
  const boards = all.filter((board) => canAccessBoard(board.id, board.ownerUserId, userId, role));
  return c.json({ boards });
});

boardRoutes.get('/:boardId', async (c) => {
  const boardId = c.req.param('boardId');
  const { userId, role } = c.get('team');
  const board = await getStore().getBoard(boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canAccessBoard(boardId, board.ownerUserId, userId, role)) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  return c.json(board);
});

boardRoutes.post('/', async (c) => {
  if (!requireEditor(c)) {
    return c.json({ error: 'Editor role required' }, 403);
  }

  const body = (await c.req.json()) as Board;
  const { userId, orgId } = c.get('team');

  const entitlement = await resolveEntitlement(userId);
  const owned = (await getStore().listBoards()).filter(
    (board) => board.ownerUserId === userId,
  );
  if (owned.length >= maxBoardCount(entitlement)) {
    return c.json({ error: 'Board limit reached for your plan', tier: entitlement.tier }, 402);
  }

  const board: Board = {
    ...body,
    ownerUserId: userId,
    orgId: orgId ?? body.orgId,
  };

  try {
    const result = await getStore().createBoard(board, userId);
    broadcastBoardEvent(result.event);
    return c.json(result, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

boardRoutes.put('/:boardId', async (c) => {
  if (!requireEditor(c)) {
    return c.json({ error: 'Editor role required' }, 403);
  }

  const boardId = c.req.param('boardId');
  const body = (await c.req.json()) as Board & { expectedVersion?: number; forceMotorPlanning?: boolean };
  const { userId, role } = c.get('team');

  const current = await getStore().getBoard(boardId);
  if (!current) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, current.ownerUserId, userId, role)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const result = await getStore().updateBoard(boardId, body, userId, {
      expectedVersion: body.expectedVersion,
      forceMotorPlanning: body.forceMotorPlanning,
    });
    broadcastBoardEvent(result.event);
    return c.json(result);
  } catch (err) {
    const error = err as Error & { status?: number; details?: unknown };
    if (error.status === 409) {
      return c.json({ error: error.message }, 409);
    }
    if (error.status === 422 && error.details) {
      return c.json({ error: error.message, ...(error.details as object) }, 422);
    }
    return c.json({ error: error.message }, 400);
  }
});

boardRoutes.post('/:boardId/import/obf', async (c) => {
  if (!requireEditor(c)) {
    return c.json({ error: 'Editor role required' }, 403);
  }

  const boardId = c.req.param('boardId');
  const raw = await c.req.text();
  const { userId, role } = c.get('team');

  const current = await getStore().getBoard(boardId);
  if (!current) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, current.ownerUserId, userId, role)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const result = await getStore().importObfBoard(boardId, raw, userId);
    broadcastBoardEvent(result.event);
    return c.json(result);
  } catch (err) {
    const error = err as Error & { status?: number; details?: unknown };
    if (error.status === 422 && error.details) {
      return c.json({ error: error.message, details: error.details }, 422);
    }
    return c.json({ error: error.message, details: error.details }, 400);
  }
});

boardRoutes.post('/:boardId/import/obz', async (c) => {
  if (!requireEditor(c)) {
    return c.json({ error: 'Editor role required' }, 403);
  }

  const boardId = c.req.param('boardId');
  const archive = new Uint8Array(await c.req.arrayBuffer());
  const { userId, role } = c.get('team');

  const current = await getStore().getBoard(boardId);
  if (!current) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, current.ownerUserId, userId, role)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const result = await getStore().importObzBoard(boardId, archive, userId);
    broadcastBoardEvent(result.event);
    return c.json(result);
  } catch (err) {
    const error = err as Error & { status?: number; details?: unknown };
    if (error.status === 422 && error.details) {
      return c.json({ error: error.message, details: error.details }, 422);
    }
    return c.json({ error: error.message, details: error.details }, 400);
  }
});

boardRoutes.get('/:boardId/export/obz', async (c) => {
  const boardId = c.req.param('boardId');
  const { userId, role } = c.get('team');

  const board = await getStore().getBoard(boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canAccessBoard(boardId, board.ownerUserId, userId, role)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const archive = await getStore().exportObzBoard(boardId);
    return new Response(archive.slice(), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${boardId}.obz"`,
      },
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 404);
  }
});

boardRoutes.get('/:boardId/export/obf', async (c) => {
  const boardId = c.req.param('boardId');
  const { userId, role } = c.get('team');

  const board = await getStore().getBoard(boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canAccessBoard(boardId, board.ownerUserId, userId, role)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const json = await getStore().exportObfBoard(boardId);
    return c.body(json, 200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${boardId}.obf"`,
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 404);
  }
});
