import { NextRequest } from 'next/server';

/**
 * The public origin of a request: the one the browser used.
 *
 * Behind the tunnel, the Next.js standalone server builds the URL that route
 * handlers see from its bind address (`HOSTNAME=0.0.0.0`, `PORT=3000`), so
 * `request.url` says `https://0.0.0.0:3000/...`. Auth.js builds its callback,
 * error and sign-out URLs from that origin, which is how every sign-in once
 * came back to `https://0.0.0.0:3000/auth/signin?error=Configuration`.
 *
 * One web deployment serves the landing host and the app host, and the PKCE,
 * state, nonce and session cookies are host-scoped, so one pinned origin
 * (`AUTH_URL`) cannot serve both. Instead the origin is rebuilt per request:
 *
 * - host: the first value of `X-Forwarded-Host`, else `Host`;
 * - proto: the first value of `X-Forwarded-Proto` (`http` or `https`), else
 *   `http` for a loopback host and `https` for any other.
 *
 * The host is used ONLY when it is in the allow-list `AUTH_PUBLIC_HOSTS`
 * (comma-separated host names, optionally with a port; set per environment in
 * the k8s web manifests). An entry without a port matches that host on any
 * port. Without `AUTH_PUBLIC_HOSTS`, the list is the host of
 * `NEXT_PUBLIC_BASE_URL`, the host of `AUTH_URL` and the loopback names
 * (development and tests). A host outside the list is never used: the caller
 * falls back to `AUTH_URL` when it is set, otherwise answers 400. That keeps a
 * forged `Host` or `X-Forwarded-Host` out of every URL Auth.js or Voxa builds.
 */

type Env = Record<string, string | undefined>;

export const AUTH_PUBLIC_HOSTS_KEY = 'AUTH_PUBLIC_HOSTS';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** A host name (DNS labels, IPv4 or bracketed IPv6) with an optional port. */
const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*|\[[0-9a-f:.]+\])(?::(\d{1,5}))?$/;

function value(env: Env, key: string): string | undefined {
  const raw = env[key]?.trim();
  return raw ? raw : undefined;
}

/** Lower-cased `host[:port]`, or null when it is not a plain host. */
export function normalizeHost(raw: string | null | undefined): string | null {
  const host = raw?.trim().toLowerCase();
  if (!host) return null;
  const match = HOST_PATTERN.exec(host);
  if (!match) return null;
  if (match[1] !== undefined && Number(match[1]) > 65535) return null;
  return host;
}

function splitHost(host: string): { name: string; port: string | undefined } {
  const match = /^(.*?)(?::(\d+))?$/.exec(host);
  return { name: match?.[1] ?? host, port: match?.[2] };
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return normalizeHost(new URL(url).host);
  } catch {
    return null;
  }
}

/** Entries of `AUTH_PUBLIC_HOSTS` that are not a plain host (names only; the readiness probe reports them). */
export function invalidPublicHostEntries(env: Env = process.env): string[] {
  const raw = value(env, AUTH_PUBLIC_HOSTS_KEY);
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry && !normalizeHost(entry));
}

/** The allow-list of public hosts (see the module comment). */
export function authPublicHosts(env: Env = process.env): string[] {
  const raw = value(env, AUTH_PUBLIC_HOSTS_KEY);
  const hosts = raw
    ? raw.split(',').map((entry) => normalizeHost(entry))
    : [hostOf(value(env, 'NEXT_PUBLIC_BASE_URL')), hostOf(value(env, 'AUTH_URL')), ...LOOPBACK_HOSTS];
  return [...new Set(hosts.filter((host): host is string => Boolean(host)))];
}

export function isAllowedPublicHost(host: string, env: Env = process.env): boolean {
  const candidate = splitHost(host);
  return authPublicHosts(env).some((entry) => {
    const allowed = splitHost(entry);
    if (allowed.name !== candidate.name) return false;
    return allowed.port === undefined || allowed.port === candidate.port;
  });
}

function firstHeaderValue(headers: Headers, name: string): string | undefined {
  const raw = headers.get(name);
  if (!raw) return undefined;
  const first = raw.split(',')[0]?.trim();
  return first ? first : undefined;
}

/** The host the browser addressed: first `X-Forwarded-Host`, else `Host` (normalized, not yet allow-listed). */
export function requestedHost(headers: Headers): string | null {
  return normalizeHost(firstHeaderValue(headers, 'x-forwarded-host') ?? headers.get('host'));
}

function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.includes(splitHost(host).name);
}

export type PublicOrigin =
  | { ok: true; origin: string; source: 'request' | 'auth-url' }
  | { ok: false; reason: 'missing-host' | 'host-not-allowed' };

/**
 * The public origin for these request headers: the requested host when it is
 * allow-listed, else `AUTH_URL` when set, else not resolvable.
 */
export function resolvePublicOrigin(headers: Headers, env: Env = process.env): PublicOrigin {
  const host = requestedHost(headers);
  if (host && isAllowedPublicHost(host, env)) {
    const forwarded = firstHeaderValue(headers, 'x-forwarded-proto')?.toLowerCase();
    const proto = forwarded === 'http' || forwarded === 'https' ? forwarded : isLoopback(host) ? 'http' : 'https';
    return { ok: true, origin: `${proto}://${host}`, source: 'request' };
  }
  const pinned = value(env, 'AUTH_URL');
  if (pinned) {
    try {
      return { ok: true, origin: new URL(pinned).origin, source: 'auth-url' };
    } catch {
      /* an unparsable AUTH_URL pins nothing */
    }
  }
  return { ok: false, reason: host ? 'host-not-allowed' : 'missing-host' };
}

/** The 400 answered when no public origin can be resolved (never echoes the host). */
export function unknownHostResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unknown host' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** `request` with its URL moved onto `origin` (path, query, method, headers and body kept). */
export function withOrigin(request: Request, origin: string): NextRequest {
  const current = new URL(request.url);
  const next = new URL(`${current.pathname}${current.search}`, origin);
  return new NextRequest(next, request);
}

export type RouteHandler = (request: NextRequest) => Promise<Response>;

/**
 * Wraps an Auth.js route handler so it sees the public origin instead of the
 * bind address. A host outside the allow-list answers 400 unless `AUTH_URL` is
 * set. Note that next-auth itself moves every handler request onto `AUTH_URL`
 * when it is set, so `AUTH_URL` remains a pin for every host (break-glass);
 * the deployments leave it unset and rely on `AUTH_PUBLIC_HOSTS`.
 */
export function withPublicOrigin(handler: RouteHandler, env: () => Env = () => process.env): RouteHandler {
  return async (request) => {
    const resolved = resolvePublicOrigin(request.headers, env());
    if (!resolved.ok) return unknownHostResponse();
    return handler(withOrigin(request, resolved.origin));
  };
}
