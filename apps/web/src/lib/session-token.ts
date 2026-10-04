import { mapTeamRoleFromClaims, type TeamRole } from '@voxa/core';
import type { JWTPayload } from 'jose';
import type { RefreshedTokens } from './janua-oidc';

/**
 * What Voxa keeps in its (encrypted, httpOnly) Auth.js session cookie. The
 * tokens stay on the server: the `session` callback (`publicSession`) is the
 * only thing page scripts ever see, and it never includes a token.
 */
export interface VoxaSessionToken {
  /** Janua subject. */
  userId?: string;
  name?: string | null;
  email?: string | null;
  /** From the RS256-verified access token's namespaced `voxa:*` roles. */
  teamRole?: TeamRole;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  /** Access-token expiry, epoch seconds. */
  expiresAt?: number;
}

/** What `GET /api/auth/session` returns to page scripts. */
export interface VoxaPublicSession {
  user: { id: string; name: string | null; email: string | null };
  teamRole: TeamRole;
  expires: string;
}

/** Refresh this long before the access token expires. */
export const REFRESH_MARGIN_SECONDS = 60;

export interface SignInAccount {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_at?: number;
  expires_in?: number;
}

export type VerifyAccessToken = (token: string) => Promise<JWTPayload>;
export type RefreshTokens = (refreshToken: string) => Promise<RefreshedTokens>;

function expiryFrom(account: SignInAccount, nowSeconds: number, claims: JWTPayload): number | null {
  if (typeof account.expires_at === 'number' && account.expires_at > nowSeconds) return account.expires_at;
  if (typeof account.expires_in === 'number' && account.expires_in > 0) {
    return nowSeconds + Math.floor(account.expires_in);
  }
  if (typeof claims.exp === 'number' && claims.exp > nowSeconds) return claims.exp;
  return null;
}

/**
 * The session built at sign-in. Returns null (sign-in refused) when Janua sent
 * no access token, or one that does not verify for the Voxa audience.
 */
export async function sessionTokenFromSignIn(
  account: SignInAccount,
  profile: { name?: string | null; email?: string | null },
  verify: VerifyAccessToken,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VoxaSessionToken | null> {
  if (typeof account.access_token !== 'string') return null;
  let claims: JWTPayload;
  try {
    claims = await verify(account.access_token);
  } catch {
    return null;
  }
  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  const expiresAt = expiryFrom(account, nowSeconds, claims);
  if (!expiresAt) return null;
  const email = typeof claims.email === 'string' ? claims.email : (profile.email ?? null);
  return {
    userId: claims.sub,
    name: profile.name ?? (typeof claims.name === 'string' ? claims.name : email),
    email,
    teamRole: mapTeamRoleFromClaims(claims as Record<string, unknown>),
    accessToken: account.access_token,
    refreshToken: account.refresh_token,
    idToken: account.id_token,
    expiresAt,
  };
}

/**
 * Called on every session read. Returns the token unchanged while the access
 * token has more than REFRESH_MARGIN_SECONDS left; otherwise rotates it with
 * the refresh token. Returns null when the session cannot continue (no
 * refresh token, refresh refused, new token does not verify), which makes
 * Auth.js clear the session cookie: a clean sign-out.
 */
export async function refreshSessionTokenIfNeeded(
  token: VoxaSessionToken,
  deps: { refresh: RefreshTokens; verify: VerifyAccessToken; nowSeconds?: number },
): Promise<VoxaSessionToken | null> {
  const now = deps.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!token.accessToken || !token.userId || typeof token.expiresAt !== 'number') return null;
  if (token.expiresAt - REFRESH_MARGIN_SECONDS > now) return token;
  if (!token.refreshToken) return null;

  let refreshed: RefreshedTokens;
  let claims: JWTPayload;
  try {
    refreshed = await deps.refresh(token.refreshToken);
    claims = await deps.verify(refreshed.accessToken);
  } catch {
    return null;
  }
  // A refresh must never switch the person the session belongs to.
  if (claims.sub !== token.userId) return null;
  return {
    ...token,
    teamRole: mapTeamRoleFromClaims(claims as Record<string, unknown>),
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    idToken: refreshed.idToken ?? token.idToken,
    expiresAt: refreshed.expiresAt,
  };
}

/** The page-visible session: identity and Voxa role for the UI, never a token. */
export function publicSession(token: VoxaSessionToken, expires: string): VoxaPublicSession {
  return {
    user: {
      id: token.userId ?? '',
      name: token.name ?? null,
      email: token.email ?? null,
    },
    teamRole: token.teamRole ?? 'communicator',
    expires,
  };
}
