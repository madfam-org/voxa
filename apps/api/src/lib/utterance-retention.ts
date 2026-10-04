import { sql } from 'drizzle-orm';
import { getSharedDb, type DbHandle } from '../db/client.js';
import { errorMessage } from './db-errors.js';

/** Opted-in utterance text is kept this many days, then cleared. */
export const UTTERANCE_TEXT_RETENTION_DAYS = 90;

/** How often each API process attempts the purge (default 6 h). */
export const DEFAULT_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Fixed key for pg_try_advisory_xact_lock, so only one replica purges at a
 * time. Any constant works as long as nothing else in this database uses it
 * ("voxa" + "utt" in ASCII).
 */
export const UTTERANCE_PURGE_LOCK_KEY = 0x766f7861757474n;

export type PurgeResult = { skipped: true } | { skipped: false; cleared: number };

/**
 * Clears `speech_text` on activations whose text was stored under an
 * `utterance_text` consent (`speech_text_consented = true`) and is older than
 * the retention period. The count row stays, so usage reports are unchanged.
 * Rows written before server-side consent existed (`speech_text_consented =
 * false`) are never touched here.
 *
 * Runs inside one transaction holding a transaction-scoped advisory lock: when
 * another replica already holds it, this run is skipped. The lock is released
 * when the transaction ends, so a crashed run never leaves it held.
 */
export async function purgeExpiredUtteranceText(
  db: DbHandle['db'],
  options: { now?: Date; retentionDays?: number } = {},
): Promise<PurgeResult> {
  const now = options.now ?? new Date();
  const retentionDays = options.retentionDays ?? UTTERANCE_TEXT_RETENTION_DAYS;
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  return db.transaction(async (tx) => {
    const lock = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${UTTERANCE_PURGE_LOCK_KEY.toString()}::bigint) as locked`,
    );
    if (!lock[0]?.locked) return { skipped: true } as const;

    const cleared = await tx.execute(sql`
      update activation_events
         set speech_text = null
       where speech_text_consented = true
         and speech_text is not null
         and recorded_at < ${cutoff}::timestamptz
    `);
    return { skipped: false, cleared: cleared.count } as const;
  });
}

export function purgeIntervalMsFromEnv(
  raw: string | undefined = process.env.VOXA_UTTERANCE_PURGE_INTERVAL_MS,
): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_PURGE_INTERVAL_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 60_000) {
    throw new Error(`VOXA_UTTERANCE_PURGE_INTERVAL_MS must be an integer >= 60000, got "${raw}"`);
  }
  return value;
}

/**
 * Starts the periodic purge on the shared pool (PostgreSQL only). Returns a
 * stop function for graceful shutdown. Failures are logged without query
 * parameters (invariant 4) and retried on the next tick.
 */
export function startUtteranceRetentionTimer(databaseUrl: string): () => void {
  const intervalMs = purgeIntervalMsFromEnv();
  const run = async () => {
    try {
      const { db } = getSharedDb(databaseUrl);
      const result = await purgeExpiredUtteranceText(db);
      if (!result.skipped && result.cleared > 0) {
        console.log(`Utterance text retention: cleared ${result.cleared} expired value(s)`);
      }
    } catch (err) {
      console.error(`Utterance text retention purge failed: ${errorMessage(err)}`);
    }
  };
  const first = setTimeout(() => void run(), 60_000);
  const timer = setInterval(() => void run(), intervalMs);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
