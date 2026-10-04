import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';

/**
 * Fixed-window request limits, in memory, per API replica.
 *
 * Browser traffic can reach the API through the web server (the media proxy
 * `/api/media/:id`, and more routes over time), and then every user arrives
 * with the SAME client address: the cluster's egress. So no limiter counts
 * authenticated traffic per address. Four limiters on `/v1/*`:
 *
 * | Limiter | Key | Counts | Default (env) |
 * |---|---|---|---|
 * | `ipRateLimit()`, before auth | client address | requests WITHOUT `Authorization: Bearer` | 600/min (`RATE_LIMIT_IP_PER_MINUTE`) |
 * | `authFailureLimit()`, around auth | client address | requests that end in 401; beyond the limit a failing request gets 429 | 60/min (`RATE_LIMIT_AUTH_FAILURES_PER_MINUTE`) |
 * | `userRateLimit()`, after auth | verified user id | every request except media reads | 300/min (`RATE_LIMIT_PER_MINUTE`) |
 * | `userRateLimit()`, after auth | verified user id | `GET /v1/media/:id` only | 600/min (`RATE_LIMIT_MEDIA_PER_MINUTE`) |
 *
 * A request with a valid token is never refused because of its address, so a
 * proxy carrying many users' sessions is limited per user, not as one client.
 * Random-token spraying from one address is bounded by the failure limiter.
 * The general per-user default allows a fast typist: each selection while
 * signed in can cost about three requests (two prediction calls and one
 * activation), and a literacy keyboard reaches roughly 100 selections a minute.
 * Media reads have their own budget because opening a board loads all of its
 * pictures at once (47 on the core board) and browsers cache them afterwards.
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
  /** Hits counted for `key` in its current window (0 when none or expired). */
  count(key: string, now?: number): number;
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
    count(key, now = Date.now()) {
      const bucket = buckets.get(key);
      return bucket && now < bucket.resetAt ? bucket.count : 0;
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
const authFailureLimiter = createRateLimiter({
  limit: () => positiveIntFromEnv('RATE_LIMIT_AUTH_FAILURES_PER_MINUTE', 60),
});
const userLimiter = createRateLimiter({
  limit: () => positiveIntFromEnv('RATE_LIMIT_PER_MINUTE', 300),
});
const mediaLimiter = createRateLimiter({
  limit: () => positiveIntFromEnv('RATE_LIMIT_MEDIA_PER_MINUTE', 600),
});
const allLimiters = [ipLimiter, authFailureLimiter, userLimiter, mediaLimiter];

const pruneTimer = setInterval(() => {
  for (const limiter of allLimiters) limiter.prune();
}, PRUNE_INTERVAL_MS);
pruneTimer.unref();

function tooMany(c: Context) {
  return c.json({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' }, 429, {
    'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
  });
}

function hasBearer(c: Context): boolean {
  const authorization = c.req.header('Authorization');
  return Boolean(authorization?.startsWith('Bearer ') && authorization.length > 'Bearer '.length);
}

const MEDIA_READ_PATH = /^\/v1\/media\/[^/]+\/?$/;

/**
 * Per-address limit for requests without credentials; runs before
 * authentication. Requests carrying a bearer token are limited per verified
 * user (`userRateLimit`) or, if the token fails, by `authFailureLimit`.
 */
export function ipRateLimit(): MiddlewareHandler {
  return async (c, next) => {
    if (!hasBearer(c) && ipLimiter.hit(`ip:${clientAddress(c)}`)) return tooMany(c);
    await next();
  };
}

/**
 * Per-address limit on failed authentication; wraps `teamAuth()`. Every 401
 * counts against the caller's address. Once an address has failed
 * RATE_LIMIT_AUTH_FAILURES_PER_MINUTE times in the window, further requests
 * from it that would fail get 429 instead of 401. A request whose token
 * verifies is never refused here, whatever its address.
 */
export function authFailureLimit(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    if (c.res.status !== 401) return;
    const key = `auth:${clientAddress(c)}`;
    const limit = positiveIntFromEnv('RATE_LIMIT_AUTH_FAILURES_PER_MINUTE', 60);
    if (authFailureLimiter.count(key) >= limit) {
      c.res = tooMany(c);
      return;
    }
    authFailureLimiter.hit(key);
  };
}

/**
 * Per-user limits; run after `teamAuth()`, keyed on the verified user id.
 * `GET /v1/media/:id` draws on its own budget, everything else on the
 * general one.
 */
export function userRateLimit(): MiddlewareHandler {
  return async (c, next) => {
    const team = c.get('team');
    if (team?.userId) {
      const media = c.req.method === 'GET' && MEDIA_READ_PATH.test(c.req.path);
      const limiter = media ? mediaLimiter : userLimiter;
      if (limiter.hit(`${media ? 'media' : 'user'}:${team.userId}`)) return tooMany(c);
    }
    await next();
  };
}

/** Test helper: clears every limiter. */
export function resetRateLimitsForTests(): void {
  for (const limiter of allLimiters) limiter.reset();
}

/** Test helper: bucket counts of the limiters. */
export function rateLimitBucketCountsForTests(): {
  ip: number;
  authFailures: number;
  user: number;
  media: number;
} {
  return {
    ip: ipLimiter.size(),
    authFailures: authFailureLimiter.size(),
    user: userLimiter.size(),
    media: mediaLimiter.size(),
  };
}
