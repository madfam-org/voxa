import { encode } from 'next-auth/jwt';
import { armorSessionJwe } from './session-cookie-codec';

/**
 * The session fields (same shape as `VoxaSessionToken` in `session-token.ts`).
 * Declared here so this file imports nothing from the workspace packages: the
 * Playwright helpers import it, and `@voxa/e2e` typechecks before
 * `@voxa/core` is built.
 */
export interface MintableSessionToken {
  userId?: string;
  name?: string | null;
  email?: string | null;
  teamRole?: 'communicator' | 'editor' | 'admin';
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
}

/**
 * Encrypts a session exactly as Auth.js does for Voxa (same salt, same armor).
 * Used by tests and by the Playwright helper that signs a test user in with a
 * test-only AUTH_SECRET; it can only mint for a server that holds that secret.
 */
export async function mintSessionCookieValue(input: {
  token: MintableSessionToken & { sub?: string };
  secret: string;
  cookieName: string;
  maxAgeSeconds?: number;
}): Promise<string> {
  const jwe = await encode({
    token: { sub: input.token.userId, ...input.token },
    secret: input.secret,
    salt: input.cookieName,
    maxAge: input.maxAgeSeconds ?? 60 * 60,
  });
  return armorSessionJwe(jwe);
}
