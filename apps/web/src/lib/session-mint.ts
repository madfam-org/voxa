import { encode } from 'next-auth/jwt';
import { armorSessionJwe } from './session-cookie-codec';
import type { VoxaSessionToken } from './session-token';

/**
 * Encrypts a session exactly as Auth.js does for Voxa (same salt, same armor).
 * Used by tests and by the Playwright helper that signs a test user in with a
 * test-only AUTH_SECRET; it can only mint for a server that holds that secret.
 */
export async function mintSessionCookieValue(input: {
  token: VoxaSessionToken & { sub?: string };
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
