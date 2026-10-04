/**
 * Entitlement acceptance tests with real RS256 access tokens (ADR-006): the
 * tier comes only from the `voxa_tier` claim of a verified Janua token.
 *
 * A JWKS is served from an in-process HTTP server on an OS-assigned loopback
 * port, so the full bearer-token path runs exactly as in production.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';
import app from '../app.js';
import * as fileStore from '../store/file-board-store.js';
import * as store from '../store/index.js';

const ISSUER = 'https://issuer.test';
const AUDIENCE = 'voxa';

let server: Server;
let privateKey: KeyLike;

before(async () => {
  const keys = await generateKeyPair('RS256');
  privateKey = keys.privateKey;
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  process.env.JANUA_ISSUER_URL = ISSUER;
  process.env.JANUA_JWKS_URL = `http://127.0.0.1:${port}/jwks.json`;
  process.env.JANUA_AUDIENCE = AUDIENCE;
});

after(() => {
  server.close();
});

async function bearer(claims: Record<string, unknown>): Promise<Record<string, string>> {
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function entitlement(claims: Record<string, unknown>) {
  const res = await app.request('/v1/billing/entitlement', { headers: await bearer(claims) });
  assert.equal(res.status, 200);
  return (await res.json()) as { tier: string; features: string[]; source: string };
}

function createBoard(id: string, headers: Record<string, string>) {
  return app.request('/v1/boards', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id,
      name: `Board ${id}`,
      profileId: 'default',
      version: 1,
      updatedAt: new Date().toISOString(),
      grid: { rows: 2, columns: 2, buttons: [] },
    }),
  });
}

describe('entitlement from the Janua voxa_tier claim', () => {
  beforeEach(async () => {
    const fresh = fileStore.createFileBoardStore();
    await fresh.resetStoreForTests?.();
    store.useTestStore(fresh);
  });

  it("voxa_tier 'clinic' → { tier: 'clinic', source: 'janua' }", async () => {
    const body = await entitlement({ sub: 'clinic-user', voxa_tier: 'clinic' });
    assert.equal(body.tier, 'clinic');
    assert.equal(body.source, 'janua');
    assert.ok(body.features.includes('boards:unlimited'));
    assert.ok(body.features.includes('ai:full'));
  });

  it('a token without the claim resolves to free', async () => {
    const body = await entitlement({ sub: 'plain-user' });
    assert.deepEqual(body, { tier: 'free', features: ['boards:1', 'sync', 'obf', 'ai:basic'], source: 'janua' });
  });

  it("an unknown value ('enterprise') resolves to free", async () => {
    const body = await entitlement({ sub: 'odd-user', voxa_tier: 'enterprise' });
    assert.equal(body.tier, 'free');
    assert.equal(body.source, 'janua');
  });

  it('a malformed claim resolves to free', async () => {
    const body = await entitlement({ sub: 'odd-user', voxa_tier: { tier: 'clinic' } });
    assert.equal(body.tier, 'free');
  });

  it('the free tier gets 402 on its second board', async () => {
    const headers = await bearer({ sub: 'free-user' });
    assert.equal((await createBoard('free-1', headers)).status, 201);
    const second = await createBoard('free-2', headers);
    assert.equal(second.status, 402);
    assert.equal(((await second.json()) as { tier: string }).tier, 'free');
  });

  it('a family token can create more boards', async () => {
    const headers = await bearer({ sub: 'family-user', voxa_tier: 'family' });
    for (const id of ['family-1', 'family-2', 'family-3']) {
      assert.equal((await createBoard(id, headers)).status, 201, id);
    }
  });

  it('an unknown claim gets the free board limit', async () => {
    const headers = await bearer({ sub: 'enterprise-user', voxa_tier: 'enterprise' });
    assert.equal((await createBoard('ent-1', headers)).status, 201);
    assert.equal((await createBoard('ent-2', headers)).status, 402);
  });
});
