/**
 * Browser hardening for the web app.
 *
 * The Content-Security-Policy is built per request in `src/middleware.ts` with
 * a fresh nonce; Next.js reads the nonce from the request's CSP header and adds
 * it to the scripts it renders, so pages are rendered dynamically (see
 * `app/[locale]/layout.tsx`). There is deliberately no `'strict-dynamic'`:
 * same-origin helper scripts that an edge proxy injects keep loading under
 * `'self'`.
 *
 * Every cross-origin source comes from the environment the app already uses
 * (API URL, Janua issuer). Nothing third-party is allowed: pictograms are served
 * from this origin and analytics, if ever enabled, is a separate decision.
 */

export interface CspEnv {
  /** `NEXT_PUBLIC_API_URL`: the Voxa API the browser calls (HTTP and WebSocket). */
  apiUrl?: string;
  /** Janua issuer(s): sign-in form posts redirect there. */
  oidcIssuers?: Array<string | undefined>;
  /** `next dev` needs eval for fast refresh; production never gets it. */
  isDev?: boolean;
}

/** `https://host[:port]` for a URL string, or null when it does not parse as http(s). */
export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/** The WebSocket origin matching an HTTP origin (`https:` → `wss:`, `http:` → `ws:`). */
export function webSocketOriginOf(httpOrigin: string): string {
  return httpOrigin.replace(/^http/, 'ws');
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

export function buildContentSecurityPolicy(nonce: string, env: CspEnv): string {
  if (!/^[A-Za-z0-9+/=_-]{16,}$/.test(nonce)) {
    throw new Error('CSP nonce must be at least 16 base64 characters');
  }
  const api = originOf(env.apiUrl);
  const issuers = unique((env.oidcIssuers ?? []).map(originOf));

  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['script-src', unique(["'self'", `'nonce-${nonce}'`, env.isDev ? "'unsafe-eval'" : null])],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    // Uploaded board images are addressed at the API origin (`/v1/media/:id`).
    ['img-src', unique(["'self'", 'data:', 'blob:', api])],
    ['media-src', ["'self'", 'blob:']],
    ['connect-src', unique(["'self'", api, api ? webSocketOriginOf(api) : null, ...issuers])],
    ['font-src', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', unique(["'self'", ...issuers])],
    ['object-src', ["'none'"]],
  ];

  return directives.map(([name, sources]) => `${name} ${sources.join(' ')}`).join('; ');
}

/** 128 random bits, base64. Works in the Edge runtime and in Node. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
