/**
 * Bounded retry for the API's FIRST database contact at startup (the migration
 * run in initStore).
 *
 * A freshly scheduled pod can see a transient connection refusal at startup
 * while the database server itself is healthy, for example before the pod's
 * network is fully programmed. Without a retry the process exits and the pod
 * restarts. This helper retries ONLY connection-level errors, with
 * exponential backoff, for a bounded total time, then rethrows the last error
 * exactly as startup did before. SQL and migration errors are never retried.
 */

/** Error codes that mean "could not reach the server", not "the query failed". */
export const RETRYABLE_CONNECTION_CODES: ReadonlySet<string> = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

/** Default total retry budget at startup, in milliseconds. */
export const DEFAULT_STARTUP_RETRY_MS = 30_000;

const INITIAL_DELAY_MS = 500;
const MAX_DELAY_MS = 5_000;

/**
 * Reads DATABASE_STARTUP_RETRY_MS: the total time startup keeps retrying a
 * connection-level error. `0` disables the retry. Unset means 30 s.
 */
export function startupRetryBudgetFromEnv(
  raw: string | undefined = process.env.DATABASE_STARTUP_RETRY_MS,
): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_STARTUP_RETRY_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`DATABASE_STARTUP_RETRY_MS must be a non-negative integer, got "${raw}"`);
  }
  return value;
}

/**
 * Returns the retryable connection code carried by `err`, looking through
 * `cause` chains (drizzle wraps driver errors) and AggregateError members
 * (Node reports one error per address it tried). Undefined for anything else.
 */
export function retryableConnectionCode(err: unknown, depth = 0): string | undefined {
  if (depth > 5 || err === null || typeof err !== 'object') return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && RETRYABLE_CONNECTION_CODES.has(code)) return code;
  const errors = (err as { errors?: unknown }).errors;
  if (Array.isArray(errors)) {
    for (const inner of errors) {
      const found = retryableConnectionCode(inner, depth + 1);
      if (found) return found;
    }
  }
  return retryableConnectionCode((err as { cause?: unknown }).cause, depth + 1);
}

export interface StartupRetryOptions {
  /** Total time to keep retrying, in ms. 0 disables retries. */
  budgetMs?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (message: string) => void;
}

/**
 * Runs `operation`; while it fails with a connection-level error and the
 * budget allows another attempt, waits (500 ms, doubling, capped at 5 s) and
 * tries again. Any other error, or a connection error once the budget is
 * spent, is rethrown unchanged. Log lines carry the error code and timing
 * only, never the connection string or the server address.
 */
export async function withStartupConnectRetry<T>(
  label: string,
  operation: () => Promise<T>,
  options: StartupRetryOptions = {},
): Promise<T> {
  const budgetMs = options.budgetMs ?? startupRetryBudgetFromEnv();
  const maxDelayMs = options.maxDelayMs ?? MAX_DELAY_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const log = options.log ?? ((message: string) => console.warn(message));

  const startedAt = now();
  let delayMs = options.initialDelayMs ?? INITIAL_DELAY_MS;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      const code = retryableConnectionCode(err);
      if (!code) throw err;
      const elapsedMs = now() - startedAt;
      const waitMs = Math.min(delayMs, maxDelayMs);
      if (elapsedMs + waitMs > budgetMs) {
        if (attempt > 1) {
          log(
            `${label}: database still unreachable (${code}) after ${attempt} attempts; giving up`,
          );
        }
        throw err;
      }
      log(`${label}: database unreachable (${code}), attempt ${attempt}; retrying in ${waitMs} ms`);
      await sleep(waitMs);
      delayMs = waitMs * 2;
    }
  }
}
