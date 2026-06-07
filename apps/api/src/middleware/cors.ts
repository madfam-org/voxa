import type { MiddlewareHandler } from 'hono';
import { cors as honoCors } from 'hono/cors';

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

export function corsMiddleware(): MiddlewareHandler {
  return honoCors({
    origin: (origin) => (origin && isAllowedOrigin(origin) ? origin : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Authorization',
      'Content-Type',
      'X-Voxa-User-Id',
      'X-Voxa-Role',
      'X-Voxa-AI-Consent',
    ],
    maxAge: 86400,
  });
}
