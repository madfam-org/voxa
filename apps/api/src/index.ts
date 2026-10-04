import { serve } from '@hono/node-server';
import app, { injectWebSocket } from './app.js';
import { closeSharedDb } from './db/client.js';
import { unwrapDbError } from './lib/db-errors.js';
import { initObservability } from './lib/observability.js';
import { startUtteranceRetentionTimer } from './lib/utterance-retention.js';
import { initStore } from './store/index.js';
import { initSyncHub, shutdownSyncHub } from './ws/sync-hub.js';

const port = Number(process.env.PORT ?? 4000);
const hostname = process.env.LISTEN_HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  initObservability();
  const driver = await initStore();
  await initSyncHub();
  // Clears opted-in utterance text past its retention period (PostgreSQL only;
  // one replica at a time via an advisory lock).
  const stopRetention =
    driver === 'postgres' && process.env.DATABASE_URL
      ? startUtteranceRetentionTimer(process.env.DATABASE_URL.trim())
      : () => {};

  const server = serve({ fetch: app.fetch, port, hostname }, () => {
    console.log(`Voxa API listening on http://${hostname}:${port}`);
  });

  injectWebSocket(server);

  const shutdown = async () => {
    stopRetention();
    await shutdownSyncHub();
    server.close();
    try {
      await closeSharedDb();
    } catch (err) {
      console.error('Failed to close the database client on shutdown', err);
    }
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
