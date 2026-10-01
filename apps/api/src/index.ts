import { serve } from '@hono/node-server';
import app, { injectWebSocket } from './app.js';
import { unwrapDbError } from './lib/db-errors.js';
import { initObservability } from './lib/observability.js';
import { initStore } from './store/index.js';
import { initSyncHub, shutdownSyncHub } from './ws/sync-hub.js';

const port = Number(process.env.PORT ?? 4000);
const hostname = process.env.LISTEN_HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  initObservability();
  await initStore();
  await initSyncHub();

  const server = serve({ fetch: app.fetch, port, hostname }, () => {
    console.log(`Voxa API listening on http://${hostname}:${port}`);
  });

  injectWebSocket(server);

  const shutdown = async () => {
    await shutdownSyncHub();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  const startupError = unwrapDbError(err);
  console.error('Failed to start Voxa API', startupError);
  void import('./lib/observability.js').then(({ captureException }) =>
    captureException(startupError),
  );
  process.exit(1);
});
