import { Hono } from 'hono';
import {
  createBoardId,
  createStarterBoard,
  isStarterContentLocale,
  listStarterTemplates,
  type Board,
  type StarterTemplateId,
} from '@voxa/core';
import { canAccessBoard, canEditBoard } from '../lib/board-access.js';
import { maxBoardCount, resolveEntitlement } from '../lib/entitlement.js';
import { getStore } from '../store/index.js';
import { broadcastBoardEvent } from '../ws/sync-hub.js';
import { errorMessage, unwrapDbError } from '../lib/db-errors.js';

export const boardRoutes = new Hono();

boardRoutes.get('/', async (c) => {
  const { userId, role, orgId } = c.get('team');
  const all = await getStore().listBoards();
  const boards = all.filter((board) =>
    canAccessBoard(board.id as string, board.ownerUserId, userId, role, board.orgId, orgId),
  );
  return c.json({ boards });
});

boardRoutes.get('/templates/list', async (c) => {
  return c.json({ templates: listStarterTemplates() });
});

boardRoutes.get('/:boardId/audit', async (c) => {
  const boardId = c.req.param('boardId');
  const { userId, role, orgId } = c.get('team');
  const board = await getStore().getBoard(boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  // The audit trail names who edited a board: only people who may edit it see it.
  if (!canEditBoard(boardId, board.ownerUserId, userId, role, board.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const since = Number(c.req.query('since') ?? 0);
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50) || 50, 1), 200);
  const events = await getStore().getRecentEvents(createBoardId(boardId), since);
  const audit = events
    .filter((event) => event.type === 'board.updated' || event.type === 'board.created')
    .slice(-limit)
    .reverse();

  return c.json({ events: audit });
});

boardRoutes.get('/:boardId', async (c) => {
  const boardId = c.req.param('boardId');
  const { userId, role, orgId } = c.get('team');
  const board = await getStore().getBoard(boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canAccessBoard(boardId, board.ownerUserId, userId, role, board.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  return c.json(board);
});

boardRoutes.post('/', async (c) => {
  // Any signed-in user may create a board they own, within their plan's board
  // limit. Owner and organization come from the token only, never from the body.
  const body = (await c.req.json()) as Board & { templateId?: StarterTemplateId; contentLocale?: unknown };
  const team = c.get('team');
  const { userId, orgId } = team;
  if (body.templateId && body.contentLocale !== undefined && !isStarterContentLocale(body.contentLocale)) {
    return c.json({ error: 'contentLocale must be one of es-MX, en-US, fr-FR' }, 400);
  }
  // Spanish-first: a template request without a locale is built in es-MX.
  const contentLocale = isStarterContentLocale(body.contentLocale) ? body.contentLocale : 'es-MX';

  const entitlement = resolveEntitlement(team);
  const owned = (await getStore().listBoards()).filter(
    (board) => board.ownerUserId === userId,
  );
  if (owned.length >= maxBoardCount(entitlement)) {
    return c.json({ error: 'Board limit reached for your plan', tier: entitlement.tier }, 402);
  }

  const board: Board = body.templateId
    ? {
        ...createStarterBoard(body.templateId, {
          boardId: body.id as string,
          name: body.name,
          profileId: body.profileId as string,
          locale: contentLocale,
        }),
        ownerUserId: userId,
        orgId,
      }
    : {
        ...body,
        ownerUserId: userId,
        orgId,
      };

  try {
    const result = await getStore().createBoard(board, userId);
    broadcastBoardEvent(result.event);
    return c.json(result, 201);
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 400);
  }
});

boardRoutes.put('/:boardId', async (c) => {
  const boardId = c.req.param('boardId');
  const body = (await c.req.json()) as Board & { expectedVersion?: number; forceMotorPlanning?: boolean };
  const { userId, role, orgId } = c.get('team');

  const current = await getStore().getBoard(boardId);
  if (!current) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, current.ownerUserId, userId, role, current.orgId, orgId)) {
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
    const error = unwrapDbError(err) as Error & { status?: number; details?: unknown };
    if (error.status === 409) {
      return c.json({ error: error.message }, 409);
    }
    if (error.status === 422 && error.details) {
      return c.json({ error: error.message, ...(error.details as object) }, 422);
    }
    return c.json({ error: error.message }, 400);
  }
});

boardRoutes.delete('/:boardId', async (c) => {
  const boardId = c.req.param('boardId');
  const { userId, role, orgId } = c.get('team');

  const current = await getStore().getBoard(boardId);
  if (!current) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, current.ownerUserId, userId, role, current.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    await getStore().deleteBoard(boardId, userId, role, orgId);
    return c.body(null, 204);
  } catch (err) {
    const error = unwrapDbError(err) as Error & { status?: number };
    if (error.status === 403) return c.json({ error: 'Forbidden' }, 403);
    return c.json({ error: error.message }, 400);
  }
});

boardRoutes.post('/:boardId/import/obf', async (c) => {
  const boardId = c.req.param('boardId');
  const raw = await c.req.text();
  const { userId, role, orgId } = c.get('team');

  const current = await getStore().getBoard(boardId);
  if (!current) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, current.ownerUserId, userId, role, current.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const result = await getStore().importObfBoard(boardId, raw, userId);
    broadcastBoardEvent(result.event);
    return c.json(result);
  } catch (err) {
    const error = unwrapDbError(err) as Error & { status?: number; details?: unknown };
    if (error.status === 422 && error.details) {
      return c.json({ error: error.message, details: error.details }, 422);
    }
    return c.json({ error: error.message, details: error.details }, 400);
  }
});

boardRoutes.post('/:boardId/import/obz', async (c) => {
  const boardId = c.req.param('boardId');
  const archive = new Uint8Array(await c.req.arrayBuffer());
  const { userId, role, orgId } = c.get('team');

  const current = await getStore().getBoard(boardId);
  if (!current) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, current.ownerUserId, userId, role, current.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const result = await getStore().importObzBoard(boardId, archive, userId);
    broadcastBoardEvent(result.event);
    return c.json(result);
  } catch (err) {
    const error = unwrapDbError(err) as Error & { status?: number; details?: unknown };
    if (error.status === 422 && error.details) {
      return c.json({ error: error.message, details: error.details }, 422);
    }
    return c.json({ error: error.message, details: error.details }, 400);
  }
});

boardRoutes.post('/:boardId/import/gridset', async (c) => {
  const boardId = c.req.param('boardId');
  const archive = new Uint8Array(await c.req.arrayBuffer());
  const { userId, role, orgId } = c.get('team');

  const current = await getStore().getBoard(boardId);
  if (!current) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, current.ownerUserId, userId, role, current.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const result = await getStore().importGridsetBoard(boardId, archive, userId);
    broadcastBoardEvent(result.event);
    return c.json(result);
  } catch (err) {
    const error = unwrapDbError(err) as Error & { status?: number; details?: unknown };
    if (error.status === 422 && error.details) {
      return c.json({ error: error.message, details: error.details }, 422);
    }
    return c.json({ error: error.message, details: error.details }, 400);
  }
});

boardRoutes.post('/:boardId/import/snap', async (c) => {
  const boardId = c.req.param('boardId');
  const archive = new Uint8Array(await c.req.arrayBuffer());
  const { userId, role, orgId } = c.get('team');

  const current = await getStore().getBoard(boardId);
  if (!current) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, current.ownerUserId, userId, role, current.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const result = await getStore().importSnapBoard(boardId, archive, userId);
    broadcastBoardEvent(result.event);
    return c.json(result);
  } catch (err) {
    const error = unwrapDbError(err) as Error & { status?: number; details?: unknown };
    if (error.status === 422 && error.details) {
      return c.json({ error: error.message, details: error.details }, 422);
    }
    return c.json({ error: error.message, details: error.details }, 400);
  }
});

boardRoutes.post('/:boardId/import/touchchat', async (c) => {
  const boardId = c.req.param('boardId');
  const archive = new Uint8Array(await c.req.arrayBuffer());
  const { userId, role, orgId } = c.get('team');

  const current = await getStore().getBoard(boardId);
  if (!current) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, current.ownerUserId, userId, role, current.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const result = await getStore().importTouchChatBoard(boardId, archive, userId);
    broadcastBoardEvent(result.event);
    return c.json(result);
  } catch (err) {
    const error = unwrapDbError(err) as Error & { status?: number; details?: unknown };
    if (error.status === 422 && error.details) {
      return c.json({ error: error.message, details: error.details }, 422);
    }
    return c.json({ error: error.message, details: error.details }, 400);
  }
});

boardRoutes.get('/:boardId/export/obz', async (c) => {
  const boardId = c.req.param('boardId');
  const { userId, role, orgId } = c.get('team');

  const board = await getStore().getBoard(boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canAccessBoard(boardId, board.ownerUserId, userId, role, board.orgId, orgId)) {
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
    return c.json({ error: errorMessage(err) }, 404);
  }
});

boardRoutes.get('/:boardId/export/obf', async (c) => {
  const boardId = c.req.param('boardId');
  const { userId, role, orgId } = c.get('team');

  const board = await getStore().getBoard(boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canAccessBoard(boardId, board.ownerUserId, userId, role, board.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const json = await getStore().exportObfBoard(boardId);
    return c.body(json, 200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${boardId}.obf"`,
    });
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 404);
  }
});
