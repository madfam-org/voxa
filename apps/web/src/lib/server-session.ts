import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { authSecret, isAuthConfigured, sessionCookieName, useSecureAuthCookies } from './auth-env';
import { applySetCookies, parseCookieHeader, serializeCookieJar, sessionCookieNames } from './session-cookies';
import { decodeSessionJwt } from './session-jwt';
import type { VoxaSessionToken } from './session-token';

export interface ServerSession {
  /** The decrypted session, with Janua's tokens: server code only, never returned to a page. */
  token: VoxaSessionToken | null;
  /** Set-Cookie lines the caller must add to its response (refresh rotation, or a cleared session). */
  setCookies: string[];
}

export type SessionHandler = (request: NextRequest) => Promise<Response>;

const NO_SESSION: ServerSession = { token: null, setCookies: [] };

/**
 * Reads the signed-in session for a route handler.
 *
 * It runs Auth.js's own session endpoint for the request's cookies, so the
 * same `jwt` callback runs everywhere (refresh before expiry, sign-out when
 * refresh fails). Auth.js answers that with Set-Cookie (the re-encrypted
 * session); the caller appends those lines to its response, and the token is
 * read from the cookies as they will be after that response. A route handler
 * calling `auth()` instead would drop that Set-Cookie and lose a rotated
 * refresh token.
 */
export async function readServerSession(
  request: Request,
  deps: { sessionHandler: SessionHandler; env?: Record<string, string | undefined> },
): Promise<ServerSession> {
  const env = deps.env ?? process.env;
  if (!isAuthConfigured(env)) return NO_SESSION;

  const cookieName = sessionCookieName(env);
  const jar = parseCookieHeader(request.headers.get('cookie'));
  if (sessionCookieNames(jar, cookieName).length === 0) return NO_SESSION;

  const headers = new Headers({ cookie: request.headers.get('cookie') ?? '' });
  for (const name of ['x-forwarded-host', 'x-forwarded-proto', 'host']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let response: Response;
  try {
    response = await deps.sessionHandler(
      new NextRequest(new URL('/api/auth/session', request.url), { headers }),
    );
  } catch {
    return NO_SESSION;
  }
  // Only the session cookie itself (a rotation or a deletion) goes back to the
  // browser; Auth.js's CSRF and callback cookies belong to its own endpoints.
  const setCookies = response.headers
    .getSetCookie()
    .filter((line) => line.startsWith(`${cookieName}=`) || line.startsWith(`${cookieName}.`));
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || !body) return { token: null, setCookies };

  const after = applySetCookies(jar, setCookies);
  const token = (await getToken({
    req: { headers: new Headers({ cookie: serializeCookieJar(after) }) },
    secret: authSecret(env)!,
    secureCookie: useSecureAuthCookies(env),
    cookieName,
    salt: cookieName,
    decode: decodeSessionJwt,
  })) as VoxaSessionToken | null;

  if (!token?.accessToken || !token.userId) return { token: null, setCookies };
  return { token, setCookies };
}

/** Adds the session's Set-Cookie lines to a response. */
export function withSessionCookies(response: Response, setCookies: string[]): Response {
  for (const line of setCookies) response.headers.append('Set-Cookie', line);
  return response;
}
