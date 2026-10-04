import { createNodeWebSocket } from '@hono/node-ws';
import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors.js';
import { requestBodyLimits } from './middleware/body-limit.js';
import { authFailureLimit, ipRateLimit, userRateLimit } from './middleware/rate-limit.js';
import { API_ROBOTS_TXT, securityHeaders } from './middleware/security-headers.js';
import { teamAuth } from './middleware/team-auth.js';
import { aiRoutes } from './routes/ai.js';
import { billingRoutes } from './routes/billing.js';
import { boardRoutes } from './routes/boards.js';
import { consentRoutes } from './routes/consents.js';
import { eventRoutes } from './routes/events.js';
import { mediaRoutes } from './routes/media.js';
import { symbolRoutes } from './routes/symbols.js';
import { canAccessBoard } from './lib/board-access.js';
import { buildSha } from './lib/build-info.js';
import { unwrapDbError } from './lib/db-errors.js';
import { devAuthEnabled } from './lib/dev-auth.js';
import { resolveWsTeam } from './lib/ws-auth.js';
import { checkStoreReady, getStore, getStoreDriver, storeIsAcceptable } from './store/index.js';
import { getSyncHubStatus, presenceCount, registerClient, unregisterClient } from './ws/sync-hub.js';

export const API_VERSION = '1.0.0';

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Same contract as Hono's default error handler (HTTPException responses pass
// through, anything else is a plain 500), except that the logged error goes
// through unwrapDbError: a DrizzleQueryError's message carries the query's bound
// parameters, which are user data.
app.onError((err, c) => {
  if ('getResponse' in err && typeof err.getResponse === 'function') {
    const res = (err as { getResponse: () => Response }).getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(unwrapDbError(err));
  return c.text('Internal Server Error', 500);
});

app.use('*', securityHeaders());
app.use('*', corsMiddleware());
// Order matters: the address limit counts requests without credentials (a
// proxy carrying many users' tokens shares one address), the body ceiling
// refuses oversized bodies before anything reads them, the failure limit
// counts 401s per address around teamAuth, and the user limits key on the
// identity teamAuth verified. See src/middleware/rate-limit.ts.
app.use('/v1/*', ipRateLimit());
app.use('/v1/*', requestBodyLimits());
app.use('/v1/*', authFailureLimit());
app.use('/v1/*', teamAuth());
app.use('/v1/*', userRateLimit());

app.get('/robots.txt', (c) => c.text(API_ROBOTS_TXT));

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'voxa-api',
    version: API_VERSION,
    build: buildSha(),
    store: getStoreDriver(),
  }),
);

// Readiness: the store answers, and it is a durable one (the JSON file store
// is never ready in production). An unreachable Redis does not make a replica
// unready (it degrades to local fan-out); it shows as `syncHubWarning`.
app.get('/health/ready', async (c) => {
  const store = getStoreDriver();
  const hub = getSyncHubStatus();
  const details = {
    service: 'voxa-api',
    build: buildSha(),
    store,
    syncHub: hub.mode,
    ...(hub.warning ? { syncHubWarning: hub.warning } : {}),
  };
  if (!storeIsAcceptable()) {
    return c.json(
      { status: 'unavailable', ...details, reason: 'The file store is not allowed in production' },
      503,
    );
  }
  const ready = await checkStoreReady();
  if (!ready) {
    return c.json({ status: 'unavailable', ...details }, 503);
  }
  return c.json({ status: 'ready', ...details, authEnforced: !devAuthEnabled() });
});

app.route('/v1/boards', boardRoutes);
app.route('/v1/billing', billingRoutes);
app.route('/v1/consents', consentRoutes);
app.route('/v1/events', eventRoutes);
app.route('/v1/media', mediaRoutes);
app.route('/v1/symbols', symbolRoutes);
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
          await registerClient(clientRef);
          ws.send(
            JSON.stringify({
              type: 'connected',
              boardId,
              presence: await presenceCount(boardId),
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
