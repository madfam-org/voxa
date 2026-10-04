import { Hono } from 'hono';
import { DEMO_BOARD_ID } from '@voxa/core';
import { canAccessBoard, canEditBoard } from '../lib/board-access.js';
import { deleteActivations, getActivationSummary, recordActivation } from '../lib/activations.js';
import { hasConsent, orgHasUtteranceTextDpa } from '../lib/consents.js';
import { getStore } from '../store/index.js';

export const eventRoutes = new Hono();

// Activations are counts by default (which button, when). They are recorded
// only with the caller's server-side `usage_analytics` consent, and the spoken
// text is kept only with a separate `utterance_text` consent from a user whose
// organization is on the DPA allow-list (VOXA_UTTERANCE_TEXT_DPA_ORG_IDS).
eventRoutes.post('/activations', async (c) => {
  const body = (await c.req.json()) as {
    boardId?: string;
    buttonId?: string;
    speechText?: string;
    recordedAt?: string;
  };

  if (!body.boardId || !body.buttonId) {
    return c.json({ error: 'boardId and buttonId are required' }, 400);
  }

  // Nobody owns the shared demo board, so nobody's usage is recorded on it.
  if (body.boardId === DEMO_BOARD_ID) {
    return c.json({ error: 'Activations are not recorded on the shared demo board' }, 403);
  }

  const { userId, role, orgId } = c.get('team');
  const board = await getStore().getBoard(body.boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canAccessBoard(body.boardId, board.ownerUserId, userId, role, board.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!(await hasConsent(databaseUrl, userId, 'usage_analytics'))) {
    return c.json({ error: 'Usage analytics consent required', purpose: 'usage_analytics' }, 403);
  }

  const keepText =
    typeof body.speechText === 'string' &&
    body.speechText.length > 0 &&
    orgHasUtteranceTextDpa(orgId) &&
    (await hasConsent(databaseUrl, userId, 'utterance_text'));

  await recordActivation(databaseUrl, userId, {
    boardId: body.boardId,
    buttonId: body.buttonId,
    speechText: keepText ? body.speechText : undefined,
    recordedAt: body.recordedAt,
  });

  return c.json({ ok: true, textStored: keepText }, 201);
});

// A board's owner may erase that board's whole activation history.
eventRoutes.delete('/activations', async (c) => {
  const boardId = c.req.query('boardId');
  if (!boardId) {
    return c.json({ error: 'boardId query parameter required' }, 400);
  }
  if (boardId === DEMO_BOARD_ID) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { userId } = c.get('team');
  const board = await getStore().getBoard(boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!board.ownerUserId || board.ownerUserId !== userId) {
    return c.json({ error: 'Only the board owner may delete its activation history' }, 403);
  }

  const deleted = await deleteActivations(process.env.DATABASE_URL, boardId);
  return c.json({ ok: true, deleted });
});

// Usage reports aggregate everyone's activity on a board: only people who may
// edit the board (its owner, or editors of its organization) see them.
eventRoutes.get('/activations/summary', async (c) => {
  const boardId = c.req.query('boardId');
  const days = Math.min(90, Math.max(1, Number(c.req.query('days') ?? '7') || 7));

  if (!boardId) {
    return c.json({ error: 'boardId query parameter required' }, 400);
  }

  const { userId, role, orgId } = c.get('team');
  const board = await getStore().getBoard(boardId);
  if (!board) return c.json({ error: 'Board not found' }, 404);
  if (!canEditBoard(boardId, board.ownerUserId, userId, role, board.orgId, orgId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const summary = await getActivationSummary(process.env.DATABASE_URL, boardId, days);
  return c.json({ summary });
});
