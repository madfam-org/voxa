import { createNodeWebSocket } from '@hono/node-ws';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { teamAuth } from './middleware/team-auth.js';
import { aiRoutes } from './routes/ai.js';
import { boardRoutes } from './routes/boards.js';
import { syncRoutes } from './routes/sync.js';
import { checkStoreReady, getStoreDriver } from './store/index.js';
import { presenceCount, registerClient, unregisterClient } from './ws/hub.js';

export const API_VERSION = '0.5.0';

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use('*', cors());
app.use('/v1/*', teamAuth());

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'voxa-api', version: API_VERSION, store: getStoreDriver() }),
);

app.get('/health/ready', async (c) => {
  const ready = await checkStoreReady();
  if (!ready) {
    return c.json({ status: 'unavailable', service: 'voxa-api', store: getStoreDriver() }, 503);
  }
  return c.json({ status: 'ready', service: 'voxa-api', store: getStoreDriver() });
});

app.route('/v1/boards', boardRoutes);
app.route('/v1/sync', syncRoutes);
app.route('/v1/ai', aiRoutes);

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

export { injectWebSocket };
export default app;
