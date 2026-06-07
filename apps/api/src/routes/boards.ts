import { Hono } from 'hono';
import type { Board } from '@voxa/core';
import { requireEditor } from '../middleware/team-auth.js';
import {
  createBoard,
  exportObfBoard,
  getBoard,
  importObfBoard,
  listBoards,
  updateBoard,
} from '../store/board-store.js';
import { broadcastBoardEvent } from '../ws/hub.js';

export const boardRoutes = new Hono();

boardRoutes.get('/', (c) => {
  return c.json({ boards: listBoards() });
});

boardRoutes.get('/:boardId', (c) => {
  const board = getBoard(c.req.param('boardId'));
  if (!board) return c.json({ error: 'Board not found' }, 404);
  return c.json(board);
});

boardRoutes.post('/', async (c) => {
  if (!requireEditor(c)) {
    return c.json({ error: 'Editor role required' }, 403);
  }

  const body = (await c.req.json()) as Board;
  const { userId } = c.get('team');

  try {
    const result = createBoard(body, userId);
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
  const { userId } = c.get('team');

  try {
    const result = updateBoard(boardId, body, userId, {
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
  const { userId } = c.get('team');

  try {
    const result = importObfBoard(boardId, raw, userId);
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

boardRoutes.get('/:boardId/export/obf', (c) => {
  const boardId = c.req.param('boardId');

  try {
    const json = exportObfBoard(boardId);
    return c.body(json, 200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${boardId}.obf"`,
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 404);
  }
});
