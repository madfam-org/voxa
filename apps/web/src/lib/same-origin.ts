import { appBaseUrl } from './auth-env';

/**
 * CSRF guard for cookie-authenticated, state-changing requests: the request
 * must come from a page of this app. Browsers send `Origin` on every POST,
 * PUT, PATCH and DELETE made by fetch or a form; `Sec-Fetch-Site` is the
 * fallback when a client omits `Origin`. Allowed origins: the public origin
 * (AUTH_URL / NEXT_PUBLIC_BASE_URL) and the origin the request was addressed to.
 */
export function isSameOriginRequest(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const allowed = new Set<string>([appBaseUrl(env)]);
  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    /* keep the configured origin only */
  }
  const origin = request.headers.get('origin');
  if (origin) return origin !== 'null' && allowed.has(origin);
  return request.headers.get('sec-fetch-site') === 'same-origin';
}
