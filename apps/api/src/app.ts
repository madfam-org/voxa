import { createNodeWebSocket } from '@hono/node-ws';
import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors.js';
import { rateLimit } from './middleware/rate-limit.js';
import { teamAuth } from './middleware/team-auth.js';
import { aiRoutes } from './routes/ai.js';
import { billingRoutes } from './routes/billing.js';
import { boardRoutes } from './routes/boards.js';
import { eventRoutes } from './routes/events.js';
import { mediaRoutes } from './routes/media.js';
import { symbolRoutes } from './routes/symbols.js';
import { syncRoutes } from './routes/sync.js';
import { canAccessBoard } from './lib/board-access.js';
import { resolveWsTeam } from './lib/ws-auth.js';
import { checkStoreReady, getStore, getStoreDriver } from './store/index.js';
import { getSyncHubMode, presenceCount, registerClient, unregisterClient } from './ws/sync-hub.js';

export const API_VERSION = '1.0.0';

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use('*', corsMiddleware());
app.use('/v1/*', rateLimit());
app.use('/v1/*', teamAuth());

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'voxa-api', version: API_VERSION, store: getStoreDriver() }),
);

app.get('/health/ready', async (c) => {
  const ready = await checkStoreReady();
  if (!ready) {
    return c.json({ status: 'unavailable', service: 'voxa-api', store: getStoreDriver() }, 503);
  }
  return c.json({
    status: 'ready',
    service: 'voxa-api',
    store: getStoreDriver(),
    syncHub: getSyncHubMode(),
    authEnforced:
      process.env.VOXA_JANUA_AUTH_REQUIRED === 'true' ||
      process.env.JANUA_AUTH_REQUIRED === 'true',
  });
});

app.route('/v1/boards', boardRoutes);
app.route('/v1/billing', billingRoutes);
app.route('/v1/events', eventRoutes);
app.route('/v1/media', mediaRoutes);
app.route('/v1/symbols', symbolRoutes);
app.route('/v1/sync', syncRoutes);
app.route('/v1/ai', aiRoutes);

app.get(
  '/v1/ws',
  upgradeWebSocket((c) => {
    const boardId = c.req.query('boardId') ?? 'demo-core';
    let clientRef: { send: (data: string) => void; boardId?: string } | null = null;
    let authorized = false;

    return {
      onOpen(_event, ws) {
        void (async () => {
          const team = await resolveWsTeam(c);
          if (!team) {
            ws.close(4401, 'Unauthorized');
            return;
          }

          const board = await getStore().getBoard(boardId);
          if (
            !board ||
            !canAccessBoard(
              boardId,
              board.ownerUserId,
              team.userId,
              team.role,
              board.orgId,
              team.orgId,
            )
          ) {
            ws.close(4403, 'Forbidden');
            return;
          }

          authorized = true;
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
        })();
      },
      onClose() {
        if (authorized && clientRef) unregisterClient(clientRef);
      },
    };
  }),
);

export { injectWebSocket };
export default app;
