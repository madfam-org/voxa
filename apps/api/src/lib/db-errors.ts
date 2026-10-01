import { DrizzleQueryError } from 'drizzle-orm';

/**
 * Since drizzle-orm 0.44, every driver error is wrapped in a DrizzleQueryError
 * whose `message` embeds the SQL text AND its bound parameters
 * (`Failed query: …\nparams: …`), and which carries them again as `query` /
 * `params`. Those parameters are user data: board content, user and org ids,
 * AAC activation events, uploaded media bytes. They must not reach an HTTP
 * response body or a log line.
 *
 * Returns the underlying driver error instead (what callers saw before 0.44),
 * or a generic error when the driver gave no cause. Any other value is
 * returned unchanged.
 */
export function unwrapDbError(err: unknown): unknown {
  if (err instanceof DrizzleQueryError) {
    return err.cause instanceof Error ? err.cause : new Error('Database query failed');
  }
  return err;
}

/** `message` of `err` after {@link unwrapDbError}. */
export function errorMessage(err: unknown): string {
  const unwrapped = unwrapDbError(err);
  return unwrapped instanceof Error ? unwrapped.message : String(unwrapped);
}
