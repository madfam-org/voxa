import type { Context, Next } from 'hono';

const buckets = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120);

function clientKey(c: Context): string {
  const team = c.get('team');
  if (team?.userId) return `user:${team.userId}`;
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return `ip:${forwarded ?? c.req.header('x-real-ip') ?? 'unknown'}`;
}

export function rateLimit() {
  return async (c: Context, next: Next) => {
    const key = clientKey(c);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > MAX_REQUESTS) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }
    await next();
  };
}
