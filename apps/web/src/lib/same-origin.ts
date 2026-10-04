import { appBaseUrl } from './auth-env';

/**
 * CSRF guard for cookie-authenticated, state-changing requests: the request
 * must come from a page of this app. Browsers send `Origin` on every POST,
 * PUT, PATCH and DELETE made by fetch or a form; `Sec-Fetch-Site` is the
 * fallback when a client omits `Origin`.
 *
 * Allowed: the public origin (AUTH_URL / NEXT_PUBLIC_BASE_URL), the origin the
 * request URL names, and an `Origin` whose host equals the request's
 * `X-Forwarded-Host` or `Host` (the check Next.js applies to server actions).
 * A server bound to 0.0.0.0 sees request URLs on another host name than the
 * browser used, which is why the Host comparison is needed.
 */
export function isSameOriginRequest(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') === 'same-origin';
  if (origin === 'null') return false;

  const allowed = new Set<string>([appBaseUrl(env)]);
  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    /* keep the configured origin only */
  }
  if (allowed.has(origin)) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.trim();
  return Boolean(host) && host === originHost;
}
