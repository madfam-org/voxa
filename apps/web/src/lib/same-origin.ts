import { appBaseUrl } from './auth-env';
import { isAllowedPublicHost, requestedHost } from './public-origin';

/**
 * CSRF guard for cookie-authenticated, state-changing requests: the request
 * must come from a page of this app. Browsers send `Origin` on every POST,
 * PUT, PATCH and DELETE made by fetch or a form; `Sec-Fetch-Site` is the
 * fallback when a client omits `Origin`.
 *
 * Allowed: the configured origin (AUTH_URL / NEXT_PUBLIC_BASE_URL), and an
 * `Origin` whose host equals the request's first `X-Forwarded-Host` or `Host`
 * (the check Next.js applies to server actions) when that host is in the
 * allow-list (AUTH_PUBLIC_HOSTS, `src/lib/public-origin.ts`). The request URL
 * is never used: a server bound to 0.0.0.0 sees request URLs on its bind
 * address, not on the host the browser used.
 */
export function isSameOriginRequest(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') === 'same-origin';
  if (origin === 'null') return false;

  if (origin === appBaseUrl(env)) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const host = requestedHost(request.headers);
  if (!host || host !== originHost) return false;
  return isAllowedPublicHost(host, env);
}
