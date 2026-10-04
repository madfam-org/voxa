import {
  januaClientConfig,
  postLogoutRedirectUri,
  sessionCookieName,
  useSecureAuthCookies,
} from './auth-env';
import { buildEndSessionUrl, januaEndpoints } from './janua-oidc';
import { expireSessionCookies, parseCookieHeader } from './session-cookies';

/**
 * `POST /auth/signout`: ends both sessions (ruling R44, RP-initiated logout).
 *
 * 1. Same-origin only (CSRF); GET answers 405, so a link or an image tag can
 *    never sign anyone out.
 * 2. Deletes the Voxa session cookie and all its chunks.
 * 3. 303 to Janua's `end_session_endpoint` (from discovery) with `client_id`,
 *    `id_token_hint` and `post_logout_redirect_uri` = this app's sign-in page,
 *    as a top-level navigation: the only shape that lets Janua delete its own
 *    estate-wide session cookie. Without it the next «Continuar con Janua» on
 *    a shared tablet silently signs the previous person back in.
 *
 * The page purges this account's local data before it submits the form
 * (`src/lib/account-data.ts`).
 */
export interface SignOutDeps {
  sameOrigin: boolean;
  /** The id token of the current session, if any. */
  idToken: () => Promise<string | undefined>;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export async function signOutResponse(request: Request, deps: SignOutDeps): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { Allow: 'POST', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  if (!deps.sameOrigin) {
    return new Response(JSON.stringify({ error: 'Cross-origin request refused' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const env = deps.env ?? process.env;
  const idToken = await deps.idToken().catch(() => undefined);
  const jar = parseCookieHeader(request.headers.get('cookie'));
  const cleared = expireSessionCookies(jar, sessionCookieName(env), useSecureAuthCookies(env));

  const client = januaClientConfig(env);
  const location = client
    ? buildEndSessionUrl({
        endSessionEndpoint: (await januaEndpoints(client.issuer, deps.fetchImpl)).endSessionEndpoint,
        clientId: client.clientId,
        idToken,
        postLogoutRedirectUri: postLogoutRedirectUri(env),
      })
    : postLogoutRedirectUri(env);

  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const line of cleared) headers.append('Set-Cookie', line);
  return new Response(null, { status: 303, headers });
}
