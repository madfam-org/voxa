import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { teamAuth } from './middleware/team-auth.js';
import { boardRoutes } from './routes/boards.js';
import { syncRoutes } from './routes/sync.js';
import { presenceCount, registerClient, unregisterClient } from './ws/hub.js';

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use('*', cors());
app.use('/v1/*', teamAuth());

app.get('/health', (c) => c.json({ status: 'ok', service: 'voxa-api', version: '0.2.0' }));

app.route('/v1/boards', boardRoutes);
app.route('/v1/sync', syncRoutes);

app.get(
  '/v1/ws',
  upgradeWebSocket((c) => {
    const boardId = c.req.query('boardId') ?? 'demo-core';
    let clientRef: { send: (data: string) => void; boardId?: string } | null = null;

    return {
      onOpen(_event, ws) {
        clientRef = {
          boardId,
          send: (data: string) => ws.send(data),
        };
        registerClient(clientRef);
        ws.send(
          JSON.stringify({
            type: 'connected',
            boardId,
            presence: presenceCount(boardId),
          }),
        );
      },
      onClose() {
        if (clientRef) unregisterClient(clientRef);
      },
    };
  }),
);

const port = Number(process.env.PORT ?? 4000);

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`Voxa API v0.2 listening on http://localhost:${port}`);
});

injectWebSocket(server);

export default app;
