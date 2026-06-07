import { Hono } from 'hono';
import type { SyncEvent } from '@voxa/core';
import { createBoardId } from '@voxa/core';
import { appendSyncEvents, getRecentEvents } from '../store/board-store.js';
import { broadcastBoardEvent } from '../ws/hub.js';

export const syncRoutes = new Hono();

syncRoutes.get('/events/:boardId', (c) => {
  const boardId = createBoardId(c.req.param('boardId'));
  const since = Number(c.req.query('since') ?? 0);
  return c.json({ events: getRecentEvents(boardId, since) });
});

syncRoutes.post('/events', async (c) => {
  const body = (await c.req.json()) as { events?: SyncEvent[] };
  const events = Array.isArray(body.events) ? body.events : [];

  appendSyncEvents(events);
  for (const event of events) {
    broadcastBoardEvent(event);
  }

  return c.json({ accepted: true, eventCount: events.length });
});
