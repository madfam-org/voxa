import type { MiddlewareHandler } from 'hono';
import { cors as honoCors } from 'hono/cors';
import { DEV_AUTH_HEADERS } from '../lib/dev-auth.js';

const DEFAULT_ORIGINS = [
  'https://voxa.madfam.io',
  'https://voxa-app.madfam.io',
  'https://voxa-staging.madfam.io',
  'https://voxa-app-staging.madfam.io',
];

function allowedOrigins(): string[] {
  const extra = process.env.CORS_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
  return [...DEFAULT_ORIGINS, ...(extra ?? [])];
}

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins().includes(origin)) return true;
  if (process.env.NODE_ENV !== 'production') {
    return origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
  }
  return /^https:\/\/[a-z0-9-]+\.madfam\.io$/.test(origin);
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

export function corsMiddleware(): MiddlewareHandler {
  return honoCors({
    origin: (origin) => (origin && isAllowedOrigin(origin) ? origin : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: allowedHeaders(),
    maxAge: 86400,
  });
}
