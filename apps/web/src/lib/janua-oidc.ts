import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { JANUA_API_AUDIENCE, type JanuaClientConfig } from './auth-env';

/**
 * Server-side helpers for the Janua OIDC provider: discovery, access-token
 * verification, refresh-token rotation and RP-initiated logout. Nothing here
 * runs in the browser.
 */

export interface JanuaEndpoints {
  tokenEndpoint: string;
  endSessionEndpoint: string;
  jwksUri: string;
}

const discoveryCache = new Map<string, Promise<JanuaEndpoints>>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function fallbackEndpoints(issuer: string): JanuaEndpoints {
  return {
    tokenEndpoint: `${issuer}/api/v1/oauth/token`,
    endSessionEndpoint: `${issuer}/logout`,
    jwksUri: `${issuer}/.well-known/jwks.json`,
  };
}

function httpsOrLocal(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

/** Janua's discovery document (cached per issuer; defaults if it cannot be read). */
export function januaEndpoints(
  issuer: string,
  fetchImpl: typeof fetch = fetch,
): Promise<JanuaEndpoints> {
  let cached = discoveryCache.get(issuer);
  if (!cached) {
    cached = (async () => {
      const fallback = fallbackEndpoints(issuer);
      try {
        const res = await fetchImpl(`${issuer}/.well-known/openid-configuration`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`discovery ${res.status}`);
        const doc = (await res.json()) as Record<string, unknown>;
        return {
          tokenEndpoint: httpsOrLocal(doc.token_endpoint, fallback.tokenEndpoint),
          endSessionEndpoint: httpsOrLocal(doc.end_session_endpoint, fallback.endSessionEndpoint),
          jwksUri: httpsOrLocal(doc.jwks_uri, fallback.jwksUri),
        };
      } catch {
        discoveryCache.delete(issuer);
        return fallback;
      }
    })();
    discoveryCache.set(issuer, cached);
  }
  return cached;
}

export function resetJanuaCachesForTests(): void {
  discoveryCache.clear();
  jwksCache.clear();
  recentRefreshes.clear();
  inflightRefreshes.clear();
}

/**
 * Verifies a Janua access token RS256 against Janua's JWKS, with the Voxa API
 * audience. The web reads the user's Voxa role only from a token that passed
 * this check.
 */
export async function verifyJanuaAccessToken(
  token: string,
  issuer: string,
  options: { jwksUri?: string } = {},
): Promise<JWTPayload> {
  const jwksUri = options.jwksUri ?? (await januaEndpoints(issuer)).jwksUri;
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri), { cacheMaxAge: 10 * 60 * 1000 });
    jwksCache.set(jwksUri, jwks);
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: JANUA_API_AUDIENCE,
    algorithms: ['RS256'],
    clockTolerance: 30,
  });
  return payload;
}

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds. */
  expiresAt: number;
  idToken?: string;
}

/**
 * Janua rotates the refresh token on every use. Several requests from the same
 * browser can reach this replica at once with the same refresh token, so the
 * exchange runs once per refresh token (single flight) and its answer is
 * remembered briefly for late arrivals.
 */
const inflightRefreshes = new Map<string, Promise<RefreshedTokens>>();
const recentRefreshes = new Map<string, { at: number; tokens: RefreshedTokens }>();
const RECENT_REFRESH_MS = 60_000;

export async function refreshJanuaTokens(
  refreshToken: string,
  client: JanuaClientConfig,
  options: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<RefreshedTokens> {
  const now = options.now ?? Date.now;
  for (const [key, entry] of recentRefreshes) {
    if (now() - entry.at > RECENT_REFRESH_MS) recentRefreshes.delete(key);
  }
  const recent = recentRefreshes.get(refreshToken);
  if (recent) return recent.tokens;
  const inflight = inflightRefreshes.get(refreshToken);
  if (inflight) return inflight;

  const run = (async () => {
    const fetchImpl = options.fetchImpl ?? fetch;
    const { tokenEndpoint } = await januaEndpoints(client.issuer, fetchImpl);
    const res = await fetchImpl(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${encodeURIComponent(client.clientId)}:${encodeURIComponent(client.clientSecret)}`)}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`refresh failed (${res.status})`);
    const body = (await res.json()) as Record<string, unknown>;
    const expiresIn = Number(body.expires_in);
    if (typeof body.access_token !== 'string' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new Error('refresh answer malformed');
    }
    const tokens: RefreshedTokens = {
      accessToken: body.access_token,
      // Janua rotates; keep the old one only if a server ever stops rotating.
      refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : refreshToken,
      expiresAt: Math.floor(now() / 1000) + Math.floor(expiresIn),
      idToken: typeof body.id_token === 'string' ? body.id_token : undefined,
    };
    recentRefreshes.set(refreshToken, { at: now(), tokens });
    return tokens;
  })();
  inflightRefreshes.set(refreshToken, run);
  try {
    return await run;
  } finally {
    inflightRefreshes.delete(refreshToken);
  }
}

/**
 * RP-initiated logout URL (GET form, for a top-level navigation). Janua
 * requires `client_id` and accepts a `post_logout_redirect_uri` only when it
 * is a registered redirect URI of that client (or the origin root of one).
 */
export function buildEndSessionUrl(input: {
  endSessionEndpoint: string;
  clientId: string;
  idToken?: string;
  postLogoutRedirectUri: string;
}): string {
  const url = new URL(input.endSessionEndpoint);
  url.searchParams.set('client_id', input.clientId);
  if (input.idToken) url.searchParams.set('id_token_hint', input.idToken);
  url.searchParams.set('post_logout_redirect_uri', input.postLogoutRedirectUri);
  return url.toString();
}
