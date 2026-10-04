import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';

/**
 * Fixed-window request limits, in memory, per API replica.
 *
 * Two limiters run on `/v1/*`:
 *
 * - `ipRateLimit()` runs BEFORE authentication and keys on the client address
 *   (`clientAddress()`): every request counts, including ones that fail with
 *   401. Its default is generous because several people can share one address
 *   (a school or a clinic behind one NAT).
 * - `userRateLimit()` runs AFTER `teamAuth()` and keys on the verified user id,
 *   so a signed-in caller cannot escape it by changing addresses.
 *
 * Limits stay per replica: with N replicas a caller can reach at most N times
 * the configured rate. That is acceptable for abuse protection (Cloudflare sits
 * in front, and the numbers are ceilings, not quotas); a shared counter would
 * add a Redis round trip to every request.
 */

export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Upper bound on buckets per limiter; the oldest are evicted beyond it. */
export const DEFAULT_MAX_BUCKETS = 50_000;

/** How often expired buckets are removed. */
const PRUNE_INTERVAL_MS = 60_000;

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** Counts one hit for `key`; true when the key is over its limit. */
  hit(key: string, now?: number): boolean;
  /** Removes expired buckets; returns how many were removed. */
  prune(now?: number): number;
  size(): number;
  reset(): void;
}

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function createRateLimiter(options: {
  limit: () => number;
  windowMs?: number;
  maxBuckets?: number;
}): RateLimiter {
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const maxBuckets = options.maxBuckets ?? DEFAULT_MAX_BUCKETS;
  const buckets = new Map<string, Bucket>();

  function prune(now = Date.now()): number {
    let removed = 0;
    for (const [key, bucket] of buckets) {
      if (now >= bucket.resetAt) {
        buckets.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  return {
    hit(key, now = Date.now()) {
      let bucket = buckets.get(key);
      if (!bucket || now >= bucket.resetAt) {
        if (bucket) buckets.delete(key);
        if (buckets.size >= maxBuckets) {
          prune(now);
          // Still full: evict the oldest buckets (Map keeps insertion order).
          for (const oldest of buckets.keys()) {
            if (buckets.size < maxBuckets) break;
            buckets.delete(oldest);
          }
        }
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      return bucket.count > options.limit();
    },
    prune,
    size: () => buckets.size,
    reset: () => buckets.clear(),
  };
}

/**
 * The caller's address. Behind Cloudflare the edge sets `CF-Connecting-IP`
 * (and overwrites any value a client sends); without it, the socket's peer
 * address. `X-Forwarded-For` is never used: its first hop is whatever the
 * client wrote.
 */
export function clientAddress(c: Context): string {
  const cf = c.req.header('cf-connecting-ip')?.trim();
  if (cf) return cf;
  try {
    const address = getConnInfo(c).remote.address;
    if (address) return address;
  } catch {
    // No Node socket (for example `app.request()` in tests).
  }
  return 'unknown';
}

const ipLimiter = createRateLimiter({
  limit: () => positiveIntFromEnv('RATE_LIMIT_IP_PER_MINUTE', 600),
});
const userLimiter = createRateLimiter({
  limit: () => positiveIntFromEnv('RATE_LIMIT_PER_MINUTE', 120),
});

const pruneTimer = setInterval(() => {
  ipLimiter.prune();
  userLimiter.prune();
}, PRUNE_INTERVAL_MS);
pruneTimer.unref();

function tooMany(c: Context) {
  return c.json({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' }, 429, {
    'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
  });
}

/** Per-address limit; runs before authentication. */
export function ipRateLimit(): MiddlewareHandler {
  return async (c, next) => {
    if (ipLimiter.hit(`ip:${clientAddress(c)}`)) return tooMany(c);
    await next();
  };
}

/** Per-user limit; runs after `teamAuth()`, keyed on the verified user id. */
export function userRateLimit(): MiddlewareHandler {
  return async (c, next) => {
    const team = c.get('team');
    if (team?.userId && userLimiter.hit(`user:${team.userId}`)) return tooMany(c);
    await next();
  };
}

/** Test helper: clears both limiters. */
export function resetRateLimitsForTests(): void {
  ipLimiter.reset();
  userLimiter.reset();
}

/** Test helper: bucket counts of both limiters. */
export function rateLimitBucketCountsForTests(): { ip: number; user: number } {
  return { ip: ipLimiter.size(), user: userLimiter.size() };
}
