import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok', service: 'voxa-api', version: '0.1.0' }));

app.get('/v1/boards/:boardId', (c) => {
  const boardId = c.req.param('boardId');
  return c.json({
    id: boardId,
    name: 'Synced board placeholder',
    version: 1,
    message: 'Cloud sync lands in v0.2 — board CRUD + WebSocket patches',
  });
});

app.post('/v1/sync/events', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ accepted: true, eventCount: Array.isArray(body?.events) ? body.events.length : 0 });
});

const port = Number(process.env.PORT ?? 4000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Voxa API listening on http://localhost:${port}`);
});

export default app;
