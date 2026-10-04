import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';

/**
 * An in-process stand-in for Janua's OIDC endpoints on a loopback port:
 * discovery, JWKS, and a token endpoint whose refresh answer the test sets.
 * Access tokens are real RS256 JWTs for the `voxa` audience.
 */
export interface FakeJanua {
  issuer: string;
  accessToken(claims: Record<string, unknown>, expiresInSeconds?: number): Promise<string>;
  /** What the token endpoint answers next; `null` → 400 invalid_grant. */
  setRefreshAnswer(answer: Record<string, unknown> | null): void;
  tokenRequests: Array<{ authorization: string | undefined; body: string }>;
  close(): Promise<void>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += String(chunk)));
    req.on('end', () => resolve(data));
  });
}

export async function startFakeJanua(): Promise<FakeJanua> {
  const keys = await generateKeyPair('RS256');
  const privateKey: KeyLike = keys.privateKey;
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'fake-janua', alg: 'RS256', use: 'sig' };
  let refreshAnswer: Record<string, unknown> | null = null;
  const tokenRequests: FakeJanua['tokenRequests'] = [];
  let issuer = '';

  const server: Server = createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (path === '/.well-known/openid-configuration') {
      return json(200, {
        issuer,
        authorization_endpoint: `${issuer}/api/v1/oauth/authorize`,
        token_endpoint: `${issuer}/api/v1/oauth/token`,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
        end_session_endpoint: `${issuer}/logout`,
      });
    }
    if (path === '/.well-known/jwks.json') return json(200, { keys: [jwk] });
    if (path === '/api/v1/oauth/token' && req.method === 'POST') {
      tokenRequests.push({ authorization: req.headers.authorization, body: await readBody(req) });
      if (!refreshAnswer) return json(400, { detail: 'invalid_grant' });
      return json(200, refreshAnswer);
    }
    return json(404, { error: 'not found' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    issuer,
    tokenRequests,
    async accessToken(claims, expiresInSeconds = 3600) {
      return new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'fake-janua' })
        .setIssuer(issuer)
        .setAudience('voxa')
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
        .sign(privateKey);
    },
    setRefreshAnswer(answer) {
      refreshAnswer = answer;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
