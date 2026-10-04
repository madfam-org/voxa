/**
 * Sign-in configuration (Auth.js with Janua as its OIDC provider).
 *
 * - `AUTH_SECRET`: encrypts this app's session cookie. Its own secret, never
 *   the Janua client secret (ruling R42).
 * - `AUTH_JANUA_ISSUER`, `AUTH_JANUA_CLIENT_ID`, `AUTH_JANUA_CLIENT_SECRET`:
 *   the Janua confidential client.
 * - `AUTH_PUBLIC_HOSTS`: the hosts this web answers sign-in on
 *   (comma-separated). Auth.js and sign-out build their URLs on the host the
 *   browser used only when it is in this list (`src/lib/public-origin.ts`).
 * - `AUTH_URL` (optional, break-glass): pins every callback and sign-out URL to
 *   one origin, for every host. Leave it unset when one deployment serves
 *   several hosts.
 *
 * Read per call, never at import: `next build` evaluates modules without
 * secrets, and a missing value must be a readiness failure, not a build one.
 */
export const AUTH_ENV_KEYS = [
  'AUTH_SECRET',
  'AUTH_JANUA_ISSUER',
  'AUTH_JANUA_CLIENT_ID',
  'AUTH_JANUA_CLIENT_SECRET',
] as const;

export type AuthEnvKey = (typeof AUTH_ENV_KEYS)[number];

/**
 * Audience of the Janua access tokens the Voxa API accepts. The web verifies
 * the same audience before it trusts any claim for the UI.
 */
export const JANUA_API_AUDIENCE = 'voxa';

/** Auth.js provider id; the callback path is `/api/auth/callback/janua`. */
export const JANUA_PROVIDER_ID = 'janua';

type Env = Record<string, string | undefined>;

function value(env: Env, key: string): string | undefined {
  const raw = env[key]?.trim();
  return raw ? raw : undefined;
}

/** Names (never values) of the settings sign-in still needs. */
export function missingAuthEnv(env: Env = process.env): AuthEnvKey[] {
  return AUTH_ENV_KEYS.filter((key) => !value(env, key));
}

export function isAuthConfigured(env: Env = process.env): boolean {
  return missingAuthEnv(env).length === 0;
}

export interface JanuaClientConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

export function januaClientConfig(env: Env = process.env): JanuaClientConfig | null {
  const issuer = value(env, 'AUTH_JANUA_ISSUER');
  const clientId = value(env, 'AUTH_JANUA_CLIENT_ID');
  const clientSecret = value(env, 'AUTH_JANUA_CLIENT_SECRET');
  if (!issuer || !clientId || !clientSecret) return null;
  return { issuer: issuer.replace(/\/+$/, ''), clientId, clientSecret };
}

export function authSecret(env: Env = process.env): string | undefined {
  return value(env, 'AUTH_SECRET');
}

/** The app's public origin (`https://host`), used for callback and sign-out URLs. */
export function appBaseUrl(env: Env = process.env): string {
  const raw = value(env, 'AUTH_URL') ?? value(env, 'NEXT_PUBLIC_BASE_URL') ?? 'http://localhost:3000';
  try {
    return new URL(raw).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

/** Secure (`__Secure-`) cookies whenever the public origin is https. */
export function useSecureAuthCookies(env: Env = process.env): boolean {
  return appBaseUrl(env).startsWith('https://');
}

/** Name of the Auth.js session cookie (chunks append `.0`, `.1`, …). */
export function sessionCookieName(env: Env = process.env): string {
  return useSecureAuthCookies(env) ? '__Secure-authjs.session-token' : 'authjs.session-token';
}

/** Whether the public origin is pinned with AUTH_URL. */
export function hasPinnedAuthUrl(env: Env = process.env): boolean {
  return Boolean(value(env, 'AUTH_URL'));
}

/**
 * Where Janua sends the browser after RP-initiated logout: the sign-in page.
 * With AUTH_URL pinned, on that origin; otherwise on `requestOrigin`, the
 * allow-listed public origin of the request (`resolvePublicOrigin`), falling
 * back to NEXT_PUBLIC_BASE_URL. Janua accepts only registered URIs either way.
 */
export function postLogoutRedirectUri(env: Env = process.env, requestOrigin?: string): string {
  const base = !hasPinnedAuthUrl(env) && requestOrigin ? requestOrigin : appBaseUrl(env);
  return `${base}/auth/signin`;
}
