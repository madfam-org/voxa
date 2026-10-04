import { spawn, type ChildProcess } from 'node:child_process';
import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * A real Voxa API (built `apps/api/dist`) on the URL the web build calls,
 * with the file store in a temporary directory and Janua replaced by an
 * in-process JWKS. Tokens minted here are real RS256 tokens: the API verifies
 * them exactly as it verifies Janua's, so board and media authorization run
 * unchanged. Development identity headers stay off (`VOXA_DEV_AUTH` unset).
 */
const ISSUER = 'https://issuer.e2e.test';
const AUDIENCE = 'voxa';
const KID = 'e2e-key';

export interface LocalApi {
  url: string;
  token(claims: Record<string, unknown>): string;
  stop(): Promise<void>;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signJwt(privateKey: KeyObject, claims: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID }));
  const payload = base64Url(
    JSON.stringify({ iss: ISSUER, aud: AUDIENCE, iat: now, exp: now + 3600, ...claims }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${base64Url(signer.sign(privateKey))}`;
}

async function waitForHealth(url: string, child: ChildProcess, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Voxa API exited early (code ${child.exitCode})`);
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Voxa API did not answer ${url}/health within ${timeoutMs} ms`);
}

export async function startLocalApi(apiUrl: string): Promise<LocalApi> {
  const entry = path.resolve(__dirname, '../../apps/api/dist/index.js');
  if (!existsSync(entry)) {
    throw new Error(`${entry} is missing: build the API first (pnpm --filter @voxa/api... build)`);
  }
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };
  const jwks: Server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => jwks.listen(0, '127.0.0.1', resolve));
  const { port: jwksPort } = jwks.address() as AddressInfo;

  const api = new URL(apiUrl);
  // Another process already answers on this URL (a stale run): fail visibly
  // instead of minting tokens it would reject.
  const stale = await fetch(`${api.origin}/health`).then(
    () => true,
    () => false,
  );
  if (stale) {
    jwks.close();
    throw new Error(`Something already listens on ${api.origin}; stop it before running this spec`);
  }

  const dataDir = mkdtempSync(path.join(tmpdir(), 'voxa-e2e-api-'));
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    PORT: api.port || '80',
    LISTEN_HOST: api.hostname,
    VOXA_DATA_DIR: dataDir,
    JANUA_ISSUER_URL: ISSUER,
    JANUA_JWKS_URL: `http://127.0.0.1:${jwksPort}/jwks.json`,
    JANUA_AUDIENCE: AUDIENCE,
  };
  const child = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  // Never outlive the test worker, even when it ends without running afterAll.
  const killChild = () => {
    if (child.exitCode === null) child.kill('SIGTERM');
  };
  process.once('exit', killChild);
  let log = '';
  child.stdout?.on('data', (chunk) => (log += String(chunk)));
  child.stderr?.on('data', (chunk) => (log += String(chunk)));

  const url = api.origin;
  try {
    await waitForHealth(url, child, 30_000);
  } catch (err) {
    child.kill('SIGTERM');
    jwks.close();
    rmSync(dataDir, { recursive: true, force: true });
    throw new Error(`${(err as Error).message}\n${log.slice(-2000)}`);
  }

  return {
    url,
    token: (claims) => signJwt(privateKey, claims),
    async stop() {
      process.removeListener('exit', killChild);
      if (child.exitCode === null) {
        await new Promise<void>((resolve) => {
          child.once('exit', () => resolve());
          child.kill('SIGTERM');
        });
      }
      await new Promise<void>((resolve) => jwks.close(() => resolve()));
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
