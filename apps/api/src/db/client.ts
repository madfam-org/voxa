import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema.js';

/**
 * Connection pool size for the API process.
 *
 * The API database is shared with other services under a fixed connection
 * budget, so every API process holds exactly ONE pool (see getSharedDb) and
 * keeps it small. With the default of 5 and two production replicas the API
 * holds at most 10 connections. Override with DATABASE_POOL_MAX.
 */
export const DEFAULT_POOL_MAX = 5;

/** Seconds an idle pooled connection is kept before it is closed. */
export const POOL_IDLE_TIMEOUT_SECONDS = 30;

export function migrationsFolder(): string {
  return join(process.cwd(), 'drizzle/migrations');
}

export function poolMaxFromEnv(raw: string | undefined = process.env.DATABASE_POOL_MAX): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_POOL_MAX;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`DATABASE_POOL_MAX must be a positive integer, got "${raw}"`);
  }
  return value;
}

let dbClientsCreated = 0;

/**
 * Opens a NEW postgres-js pool. Callers own it and must `client.end()` it.
 * Request-path code must use getSharedDb() instead; calling this per request
 * leaks a pool per call.
 */
export function createDb(databaseUrl: string, options: { max?: number } = {}) {
  dbClientsCreated += 1;
  const client = postgres(databaseUrl, {
    max: options.max ?? poolMaxFromEnv(),
    idle_timeout: POOL_IDLE_TIMEOUT_SECONDS,
  });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type DbHandle = ReturnType<typeof createDb>;

let shared: { url: string; handle: DbHandle } | null = null;

/**
 * The process-wide database client. Created lazily on first use and reused by
 * every caller (board store, media store, activations) until closeSharedDb().
 */
export function getSharedDb(databaseUrl: string): DbHandle {
  const url = databaseUrl.trim();
  if (!shared) {
    shared = { url, handle: createDb(url) };
    return shared.handle;
  }
  if (shared.url !== url) {
    throw new Error('getSharedDb called with a different database URL than the shared client uses');
  }
  return shared.handle;
}

/** Closes the shared client (graceful shutdown). Safe to call when none exists. */
export async function closeSharedDb(): Promise<void> {
  if (!shared) return;
  const { client } = shared.handle;
  shared = null;
  await client.end({ timeout: 5 });
}

/** Test helper: number of pools opened by createDb() in this process. */
export function dbClientsCreatedForTests(): number {
  return dbClientsCreated;
}

export async function runMigrations(databaseUrl: string): Promise<void> {
  const { db, client } = createDb(databaseUrl, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: migrationsFolder() });
  } finally {
    await client.end();
  }
}

export { schema };
