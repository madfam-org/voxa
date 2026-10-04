import { runMigrations } from '../db/client.js';
import { withStartupConnectRetry } from '../db/startup-retry.js';
import { createFileBoardStore } from './file-board-store.js';
import { createPgBoardStore } from './pg-board-store.js';
import type { BoardStore, StoreDriver } from './types.js';

let activeStore: BoardStore | null = null;
let driver: StoreDriver = 'file';

export function getStoreDriver(): StoreDriver {
  return driver;
}

export function getStore(): BoardStore {
  if (!activeStore) {
    activeStore = createFileBoardStore();
    driver = 'file';
  }
  return activeStore;
}

/** Message of the startup refusal when production has no database (A-020). */
export const PRODUCTION_REQUIRES_DATABASE_MESSAGE =
  'DATABASE_URL is required when NODE_ENV=production: refusing to start on the local JSON file store, ' +
  'whose data would live on the container filesystem and be lost on restart.';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * True when the active store keeps data durably. The JSON file store is for
 * local development and tests; in production it is never acceptable.
 */
export function storeIsAcceptable(): boolean {
  return driver === 'postgres' || !isProduction();
}

export async function initStore(): Promise<StoreDriver> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl && isProduction()) {
    throw new Error(PRODUCTION_REQUIRES_DATABASE_MESSAGE);
  }

  if (databaseUrl) {
    // First database contact. A transient connection refusal at startup is
    // retried for DATABASE_STARTUP_RETRY_MS (default 30 s); SQL and migration
    // errors are not. See src/db/startup-retry.ts.
    await withStartupConnectRetry('Voxa API startup migrations', () => runMigrations(databaseUrl));
    activeStore = createPgBoardStore(databaseUrl);
    await activeStore.ensureSeeded?.();
    driver = 'postgres';
    console.log('Voxa API store: PostgreSQL');
    return driver;
  }

  activeStore = createFileBoardStore();
  driver = 'file';
  console.log('Voxa API store: local JSON file (set DATABASE_URL for PostgreSQL)');
  return driver;
}

export async function checkStoreReady(): Promise<boolean> {
  if (!activeStore) return false;
  if (activeStore.ping) {
    return activeStore.ping();
  }
  return true;
}

/** Test helper — replace active store with an isolated file-backed instance */
export function useTestStore(store?: BoardStore): BoardStore {
  activeStore = store ?? createFileBoardStore();
  driver = 'file';
  return activeStore;
}
