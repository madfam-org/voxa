/**
 * Janua OIDC integration for Voxa web (PKCE code flow).
 * Pattern matches Tulana/forj — thin client against auth.madfam.io.
 */

import { cookies } from 'next/headers';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';

const SESSION_COOKIE = 'voxa_session';
const SESSION_DISPLAY_COOKIE = 'voxa_user';
const OAUTH_TRANSIENT_COOKIE_MAX_AGE_SECONDS = 30 * 60;

const OIDC_ISSUER = process.env.NEXT_PUBLIC_OIDC_ISSUER || 'https://auth.madfam.io';
const OIDC_CLIENT_ID = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || '';
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;

const OIDC_DISCOVERY_URL = `${OIDC_ISSUER}/.well-known/openid-configuration`;
const DEFAULT_AUTH_ENDPOINT = `${OIDC_ISSUER}/api/v1/oauth/authorize`;
const DEFAULT_TOKEN_ENDPOINT = `${OIDC_ISSUER}/api/v1/oauth/token`;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let oidcEndpoints: Promise<{ authorizationEndpoint: string; tokenEndpoint: string }> | null = null;

export interface VoxaSession {
  access_token: string;
  refresh_token?: string;
  user_id: string;
  email: string;
  name: string;
  expires_at: number;
}

export interface OidcTokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

export interface OidcStateEnvelope {
  state: string;
  cookieValue: string;
}

export interface OidcResolvedState {
  verifier: string;
  redirect_to: string;
}

function getOidcClientId(): string {
  if (!OIDC_CLIENT_ID) {
    throw new Error('NEXT_PUBLIC_OIDC_CLIENT_ID is not configured');
  }
  return OIDC_CLIENT_ID;
}

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${OIDC_ISSUER}/.well-known/jwks.json`));
  }
  return jwks;
}

function canonicalizeUrl(input: string, fallback: string): string {
  try {
    return new URL(input).toString();
  } catch {
    return fallback;
  }
}

function getDiscoveryEndpoints() {
  if (!oidcEndpoints) {
    oidcEndpoints = (async () => {
      try {
        const response = await fetch(OIDC_DISCOVERY_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`discovery failed: ${response.status}`);
        const payload = (await response.json()) as {
          authorization_endpoint?: unknown;
          token_endpoint?: unknown;
        };
        return {
          authorizationEndpoint: canonicalizeUrl(
            typeof payload.authorization_endpoint === 'string'
              ? payload.authorization_endpoint
              : '',
            DEFAULT_AUTH_ENDPOINT,
          ),
          tokenEndpoint: canonicalizeUrl(
            typeof payload.token_endpoint === 'string' ? payload.token_endpoint : '',
            DEFAULT_TOKEN_ENDPOINT,
          ),
        };
      } catch {
        return {
          authorizationEndpoint: DEFAULT_AUTH_ENDPOINT,
          tokenEndpoint: DEFAULT_TOKEN_ENDPOINT,
        };
      }
    })();
  }
  return oidcEndpoints;
}

export function isOidcConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_OIDC_CLIENT_ID && process.env.NEXT_PUBLIC_OIDC_ISSUER);
}

export function normalizeAuthRedirectPath(redirectTo: string): string {
  if (!redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
    return '/';
  }
  return redirectTo;
}

export async function getAuthorizeUrl(opts: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): Promise<string> {
  const endpoints = await getDiscoveryEndpoints();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getOidcClientId(),
    redirect_uri: opts.redirectUri,
    scope: 'openid email profile offline_access',
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${endpoints.authorizationEndpoint}?${params.toString()}`;
}

export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<OidcTokenResponse> {
  const endpoints = await getDiscoveryEndpoints();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: getOidcClientId(),
    code_verifier: opts.codeVerifier,
  });
  if (OIDC_CLIENT_SECRET) {
    body.set('client_secret', OIDC_CLIENT_SECRET);
  }

  const res = await fetch(endpoints.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Janua token exchange failed: ${res.status}`);
  }
  return (await res.json()) as OidcTokenResponse;
}

export async function verifyIdToken(idToken: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(idToken, getJwks(), {
    issuer: OIDC_ISSUER,
    audience: getOidcClientId(),
  });
  return payload;
}

export async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64UrlEncode(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)) };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function createOidcStateEnvelope(opts: {
  verifier: string;
  redirectTo: string;
}): Promise<OidcStateEnvelope> {
  const csrf = crypto.randomUUID();
  const redirectTo = normalizeAuthRedirectPath(opts.redirectTo);
  return {
    state: csrf,
    cookieValue: JSON.stringify({ state: csrf, redirect_to: redirectTo }),
  };
}

export function parseOidcStateCookie(
  state: string,
  cookieValue: string | undefined,
): OidcResolvedState | null {
  if (!cookieValue) return null;
  try {
    const parsed = JSON.parse(cookieValue) as { state?: string; redirect_to?: string };
    if (parsed.state !== state || typeof parsed.redirect_to !== 'string') return null;
    return { verifier: '', redirect_to: normalizeAuthRedirectPath(parsed.redirect_to) };
  } catch {
    return null;
  }
}

export function parseVoxaSessionValue(raw: string | undefined): VoxaSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VoxaSession;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<VoxaSession | null> {
  const store = await cookies();
  const session = parseVoxaSessionValue(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  if (session.expires_at * 1000 < Date.now()) return null;
  return session;
}

export function sessionCookieAttrs(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function oidcTransientCookieAttrs(
  maxAgeSeconds = OAUTH_TRANSIENT_COOKIE_MAX_AGE_SECONDS,
) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_DISPLAY_COOKIE_NAME = SESSION_DISPLAY_COOKIE;
