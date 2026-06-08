import { Hono } from 'hono';
import { canAccessBoard } from '../lib/board-access.js';
import { getActivationSummary, recordActivation } from '../lib/activations.js';
import { requireEditor } from '../middleware/team-auth.js';
import { getStore } from '../store/index.js';

export const eventRoutes = new Hono();

function hasAnalyticsConsent(c: { req: { header: (name: string) => string | undefined } }): boolean {
  return c.req.header('X-Voxa-AI-Consent') === 'true';
}

eventRoutes.post('/activations', async (c) => {
  if (!hasAnalyticsConsent(c)) {
    return c.json({ error: 'Analytics consent required (X-Voxa-AI-Consent: true)' }, 403);
  }

  const body = (await c.req.json()) as {
    boardId?: string;
    buttonId?: string;
    speechText?: string;
    recordedAt?: string;
  };

  if (!body.boardId || !body.buttonId) {
    return c.json({ error: 'boardId and buttonId are required' }, 400);
  }

  const { userId, role, orgId } = c.get('team');
  const board = await getStore().getBoard(body.boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canAccessBoard(body.boardId, board.ownerUserId, userId, role, board.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await recordActivation(process.env.DATABASE_URL, userId, {
    boardId: body.boardId,
    buttonId: body.buttonId,
    speechText: body.speechText,
    recordedAt: body.recordedAt,
  });

  return c.json({ ok: true }, 201);
});

eventRoutes.get('/activations/summary', async (c) => {
  if (!requireEditor(c)) {
    return c.json({ error: 'Editor role required' }, 403);
  }

  const boardId = c.req.query('boardId');
  const days = Math.min(90, Math.max(1, Number(c.req.query('days') ?? '7') || 7));

  if (!boardId) {
    return c.json({ error: 'boardId query parameter required' }, 400);
  }

  const { userId, role, orgId } = c.get('team');
  const board = await getStore().getBoard(boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canAccessBoard(boardId, board.ownerUserId, userId, role, board.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const summary = await getActivationSummary(process.env.DATABASE_URL, boardId, days);
  return c.json({ summary });
});
