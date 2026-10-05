import NextAuth, { type NextAuthConfig } from 'next-auth';
import type { OIDCConfig } from 'next-auth/providers';
import {
  authSecret,
  januaClientConfig,
  JANUA_PROVIDER_ID,
  useSecureAuthCookies,
  type JanuaClientConfig,
} from '@/lib/auth-env';
import { refreshJanuaTokens, verifyJanuaAccessToken } from '@/lib/janua-oidc';
import { withPublicOrigin } from '@/lib/public-origin';
import { decodeSessionJwt, encodeSessionJwt } from '@/lib/session-jwt';
import {
  publicSession,
  refreshSessionTokenIfNeeded,
  sessionTokenFromSignIn,
  type VoxaSessionToken,
} from '@/lib/session-token';

/**
 * Sign-in for the Voxa web app: Auth.js v5 with Janua as its OIDC provider
 * (authorization code + PKCE, state and nonce), JWT session strategy.
 *
 * Why Auth.js and not `@madfam/janua-next`: the canonical adapter lives only
 * on MADFAM's private registry, and this public Apache-2.0 repository must
 * install from public npm without credentials. The Auth.js `janua` OIDC
 * provider is the documented alternative.
 *
 * Auth.js holds no users and no roles. The session cookie is encrypted with
 * AUTH_SECRET (this app's own secret, never the Janua client secret) and keeps
 * Janua's access, refresh and id tokens on the server. Page scripts see only
 * `publicSession()`; API calls go through the same-origin proxy
 * (`app/api/v1/[...path]`), which adds the bearer on the server.
 */

interface JanuaProfile {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
}

function januaProvider(client: JanuaClientConfig): OIDCConfig<JanuaProfile> {
  return {
    id: JANUA_PROVIDER_ID,
    name: 'Janua',
    type: 'oidc',
    issuer: client.issuer,
    clientId: client.clientId,
    clientSecret: client.clientSecret,
    authorization: { params: { scope: 'openid email profile offline_access' } },
    checks: ['pkce', 'state', 'nonce'],
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name ?? profile.preferred_username ?? profile.email ?? null,
        email: profile.email ?? null,
      };
    },
  };
}

/**
 * Built per request: `next build` evaluates this module without secrets, so a
 * missing setting is a readiness failure (`/api/health/ready`), never a build
 * failure. Without the Janua settings there is no provider and sign-in is off.
 */
export function buildAuthConfig(env: Record<string, string | undefined> = process.env): NextAuthConfig {
  const client = januaClientConfig(env);
  const verify = (token: string) => {
    if (!client) throw new Error('Janua is not configured');
    return verifyJanuaAccessToken(token, client.issuer);
  };

  return {
    secret: authSecret(env),
    // One web serves the landing and app hosts: the exported handlers run on
    // the public origin the browser used, rebuilt from the forwarded host and
    // allow-listed (`withPublicOrigin`, AUTH_PUBLIC_HOSTS). trustHost only
    // skips Auth.js's own host check; it never fixes the origin.
    trustHost: true,
    useSecureCookies: useSecureAuthCookies(env),
    providers: client ? [januaProvider(client)] : [],
    session: { strategy: 'jwt' },
    jwt: { encode: encodeSessionJwt, decode: decodeSessionJwt },
    pages: { signIn: '/auth/signin', error: '/auth/signin' },
    callbacks: {
      async signIn({ account }) {
        if (!account?.access_token) return false;
        try {
          await verify(account.access_token);
          return true;
        } catch {
          return false;
        }
      },

      async jwt({ token, account, profile }) {
        if (account) {
          const built = await sessionTokenFromSignIn(
            account,
            { name: token.name ?? profile?.name ?? null, email: token.email ?? null },
            verify,
          );
          // Returning null clears the session cookie (Auth.js).
          return built ? (built as typeof token) : null;
        }
        if (!client) return null;
        const next = await refreshSessionTokenIfNeeded(token as VoxaSessionToken, {
          refresh: (refreshToken) => refreshJanuaTokens(refreshToken, client),
          verify,
        });
        return next ? (next as typeof token) : null;
      },

      session({ session, token }) {
        // The only shape page scripts receive: no access, refresh or id token.
        return publicSession(token as VoxaSessionToken, session.expires) as unknown as typeof session;
      },
    },
  };
}

const nextAuth = NextAuth(() => buildAuthConfig());

export const { auth, signIn, signOut } = nextAuth;

/**
 * Auth.js route handlers on the public origin. Behind the tunnel the standalone
 * server hands route handlers a request URL on its bind address
 * (`0.0.0.0:3000`); Auth.js would build the callback, error and sign-out URLs
 * from it. Every caller (the `[...nextauth]` route, the middleware session
 * read, the API proxy) uses these.
 */
export const handlers = {
  GET: withPublicOrigin(nextAuth.handlers.GET),
  POST: withPublicOrigin(nextAuth.handlers.POST),
};
