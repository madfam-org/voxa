import type { MiddlewareHandler } from 'hono';
import { cors as honoCors } from 'hono/cors';
import { DEV_AUTH_HEADERS } from '../lib/dev-auth.js';

/**
 * Exact browser origins allowed to call the API (A-030). `CORS_ALLOWED_ORIGINS`
 * (comma-separated, set per deployment in k8s/) is the list when present;
 * otherwise the four public Voxa web hosts. No wildcard: a sibling subdomain is
 * not trusted just for sharing the parent domain. Outside production, local
 * development origins are allowed as well.
 */
const DEFAULT_ORIGINS = [
  'https://voxa.madfam.io',
  'https://voxa-app.madfam.io',
  'https://voxa-staging.madfam.io',
  'https://voxa-app-staging.madfam.io',
];

export function allowedOrigins(): string[] {
  const configured = process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return configured && configured.length > 0 ? configured : [...DEFAULT_ORIGINS];
}

export function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins().includes(origin)) return true;
  if (process.env.NODE_ENV !== 'production') {
    return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  }
  return false;
}

const BASE_HEADERS = ['Authorization', 'Content-Type', 'X-Voxa-AI-Consent'];

/**
 * The development identity headers are allowed cross-origin only outside
 * production; production browsers never get to send them.
 */
export function allowedHeaders(): string[] {
  return process.env.NODE_ENV === 'production'
    ? [...BASE_HEADERS]
    : [...BASE_HEADERS, ...DEV_AUTH_HEADERS];
}

function buildCors(headers: string[]): MiddlewareHandler {
  return honoCors({
    origin: (origin) => (origin && isAllowedOrigin(origin) ? origin : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: headers,
    maxAge: 86400,
  });
}

export function corsMiddleware(): MiddlewareHandler {
  // One handler per header set, picked per request so the allow-list always
  // follows the current NODE_ENV.
  const handlers = new Map<string, MiddlewareHandler>();
  return (c, next) => {
    const headers = allowedHeaders();
    const key = headers.join(',');
    let handler = handlers.get(key);
    if (!handler) {
      handler = buildCors(headers);
      handlers.set(key, handler);
    }
    return handler(c, next);
  };
}
