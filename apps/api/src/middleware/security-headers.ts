import type { MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

/**
 * Response hardening for the JSON API (A-005). The API serves JSON and board
 * media, never HTML, so its CSP denies everything. Cross-Origin-Resource-Policy
 * is same-site so the web app (a sibling host) can still load board media.
 * The WebSocket upgrade is left alone.
 */
const hardened = secureHeaders({
  contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  xFrameOptions: 'DENY',
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOriginResourcePolicy: 'same-site',
  xContentTypeOptions: true,
});

export function securityHeaders(): MiddlewareHandler {
  return (c, next) => (c.req.path === '/v1/ws' ? next() : hardened(c, next));
}

/** The API is never for crawlers, on any host. */
export const API_ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';
