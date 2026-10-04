import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';

const ISSUER = 'https://issuer.test';
const AUDIENCE = 'voxa';

/**
 * Real RS256 Janua-style access tokens for route tests: serves a JWKS from an
 * in-process HTTP server on an OS-assigned loopback port and points the API's
 * Janua settings at it, so tokens carry claims (such as `org_id`) that the
 * development headers cannot.
 */
export interface TestTokenIssuer {
  bearer(claims: Record<string, unknown>): Promise<Record<string, string>>;
  close(): Promise<void>;
}

export async function startTestTokenIssuer(): Promise<TestTokenIssuer> {
  const keys = await generateKeyPair('RS256');
  const privateKey: KeyLike = keys.privateKey;
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  process.env.JANUA_ISSUER_URL = ISSUER;
  process.env.JANUA_JWKS_URL = `http://127.0.0.1:${port}/jwks.json`;
  process.env.JANUA_AUDIENCE = AUDIENCE;

  return {
    async bearer(claims) {
      const token = await new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
      return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
