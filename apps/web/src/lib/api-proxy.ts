/**
 * Server side of the same-origin API proxy (`/api/v1/*`).
 *
 * Page scripts never hold an access token. They call `/api/v1/...` on this
 * origin with the session cookie; this proxy reads the session on the server
 * and forwards the call to the Voxa API with `Authorization: Bearer`. It adds
 * no access rule of its own: the API decides, and its status passes through.
 *
 * - Only `/api/v1/<segments>`; every segment is plain (`[A-Za-z0-9._~-]`, not
 *   `.` or `..`) and the path holds no percent-encoding, so nothing can step
 *   out of `/v1/` or name another host. Anything else: 400, API not called.
 * - Methods: GET, HEAD, POST, PUT, PATCH, DELETE (others: 405).
 * - CSRF: anything but GET/HEAD must come from this origin (403).
 * - No session: 401, API not called.
 * - Forwards only content-type, accept, accept-language, if-match and
 *   if-none-match, plus the bearer. Never the cookie and never the
 *   development identity headers.
 * - Streams both bodies. Passes status, content-type, content-disposition,
 *   etag and last-modified back; drops Set-Cookie and every other upstream
 *   header (hop-by-hop included). Answers `Cache-Control: private, no-store`.
 */
export const PROXY_PREFIX = '/api/v1/';
export const PROXY_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const SAFE_METHODS = new Set(['GET', 'HEAD']);
const SEGMENT = /^[A-Za-z0-9._~-]+$/;
const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language', 'if-match', 'if-none-match'];
const PASSED_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'etag', 'last-modified'];
export const PROXY_CACHE_CONTROL = 'private, no-store';

export interface ProxyInput {
  request: Request;
  /** Resolves the session's access token; called only after the request passed every check. */
  accessToken: () => Promise<string | undefined>;
  /** Same-origin check result for this request (`isSameOriginRequest`). */
  sameOrigin: boolean;
  apiUrl: string;
  fetchImpl?: typeof fetch;
}

function jsonError(status: number, error: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': PROXY_CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

/**
 * The upstream path (`/v1/...`) for a proxied request URL, or null when the
 * path is not a plain path under `/api/v1/`. Reads the raw pathname, before
 * any decoding.
 */
export function upstreamPath(requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  const raw = url.pathname;
  if (!raw.startsWith(PROXY_PREFIX) || raw.includes('%') || raw.includes('\\')) return null;
  const segments = raw.slice(PROXY_PREFIX.length).split('/');
  if (segments.length === 0 || segments.some((s) => !SEGMENT.test(s) || s === '.' || s === '..')) {
    return null;
  }
  return `/v1/${segments.join('/')}`;
}

export async function proxyApiRequest(input: ProxyInput): Promise<Response> {
  const { request } = input;
  const method = request.method.toUpperCase();
  if (!(PROXY_METHODS as readonly string[]).includes(method)) {
    return jsonError(405, 'Method not allowed', { Allow: PROXY_METHODS.join(', ') });
  }
  const path = upstreamPath(request.url);
  if (!path) return jsonError(400, 'Bad path');
  if (!SAFE_METHODS.has(method) && !input.sameOrigin) return jsonError(403, 'Cross-origin request refused');

  const accessToken = await input.accessToken();
  if (!accessToken) return jsonError(401, 'Unauthorized');

  const base = new URL(input.apiUrl);
  const target = new URL(path, base.origin);
  if (target.origin !== base.origin) return jsonError(400, 'Bad path');
  target.search = new URL(request.url).search;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('Authorization', `Bearer ${accessToken}`);

  const hasBody = !SAFE_METHODS.has(method) && request.body !== null;
  let upstream: Response;
  try {
    upstream = await (input.fetchImpl ?? fetch)(target, {
      method,
      headers,
      body: hasBody ? request.body : undefined,
      ...(hasBody ? { duplex: 'half' } : {}),
      redirect: 'manual',
      cache: 'no-store',
    } as RequestInit);
  } catch {
    return jsonError(502, 'API unavailable');
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel().catch(() => undefined);
    return jsonError(502, 'API unavailable');
  }

  const out = new Headers({ 'Cache-Control': PROXY_CACHE_CONTROL, 'X-Content-Type-Options': 'nosniff' });
  for (const name of PASSED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  const bodyless = method === 'HEAD' || upstream.status === 204 || upstream.status === 304;
  return new Response(bodyless ? null : upstream.body, { status: upstream.status, headers: out });
}
