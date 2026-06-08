import { Hono } from 'hono';
import type { SyncEvent } from '@voxa/core';
import { createBoardId } from '@voxa/core';
import { getStore } from '../store/index.js';
import { broadcastBoardEvent } from '../ws/sync-hub.js';

export const syncRoutes = new Hono();

syncRoutes.get('/events/:boardId', async (c) => {
  const boardId = createBoardId(c.req.param('boardId'));
  const since = Number(c.req.query('since') ?? 0);
  const events = await getStore().getRecentEvents(boardId, since);
  return c.json({ events });
});

syncRoutes.post('/events', async (c) => {
  const body = (await c.req.json()) as { events?: SyncEvent[] };
  const events = Array.isArray(body.events) ? body.events : [];

  await getStore().appendSyncEvents(events);
  for (const event of events) {
    broadcastBoardEvent(event);
  }

  return c.json({ accepted: true, eventCount: events.length });
});
