/**
 * Authorization acceptance tests with real RS256 access tokens.
 *
 * A JWKS is served from an in-process HTTP server on an OS-assigned loopback
 * port, so the full bearer-token path (jose verification, claim mapping, board
 * authorization) runs exactly as in production.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';
import { createDemoBoard, createBoardId, DEMO_BOARD_ID, type Board } from '@voxa/core';
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

async function token(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

async function bearer(claims: Record<string, unknown>): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await token(claims)}`, 'Content-Type': 'application/json' };
}

async function seedBoard(id: string, ownerUserId: string, orgId?: string): Promise<void> {
  const board: Board = { ...createDemoBoard(), id: createBoardId(id), name: id, ownerUserId };
  if (orgId) board.orgId = orgId;
  await store.getStore().createBoard(board, ownerUserId);
}

async function getBoard(id: string, headers: Record<string, string>) {
  return app.request(`/v1/boards/${id}`, { headers });
}

async function putBoard(id: string, headers: Record<string, string>, patch: Record<string, unknown> = {}) {
  const current = (await store.getStore().getBoard(id)) as Board;
  return app.request(`/v1/boards/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ ...current, name: `${current.name} edited`, expectedVersion: current.version, ...patch }),
  });
}

describe('board authorization with Janua access tokens', () => {
  beforeEach(async () => {
    const fresh = fileStore.createFileBoardStore();
    await fresh.resetStoreForTests?.();
    store.useTestStore(fresh);
    await seedBoard('victim-board', 'user-a', 'org-a');
    await seedBoard('org1-board', 'patient-1', 'org-1');
    await seedBoard('org2-board', 'patient-2', 'org-2');
  });

  it('(1) a bare `admin` org role from another org gets 403 on GET and PUT', async () => {
    const headers = await bearer({ sub: 'user-b', roles: ['admin'], org_id: 'org-unrelated' });
    assert.equal((await getBoard('victim-board', headers)).status, 403);
    assert.equal((await putBoard('victim-board', headers)).status, 403);
  });

  it('(2) `voxa:admin` reads boards of its own org only', async () => {
    const headers = await bearer({ sub: 'admin-1', roles: ['voxa:admin'], org_id: 'org-1' });
    assert.equal((await getBoard('org1-board', headers)).status, 200);
    assert.equal((await getBoard('org2-board', headers)).status, 403);
    assert.equal((await putBoard('org2-board', headers)).status, 403);
  });

  it('(3) a communicator can PUT a board they own and gets 403 on someone else’s', async () => {
    await seedBoard('own-board', 'user-c');
    const headers = await bearer({ sub: 'user-c', roles: [] });
    assert.equal((await putBoard('own-board', headers)).status, 200);
    assert.equal((await putBoard('victim-board', headers)).status, 403);
  });

  it('(4) an editor gets 403 on PUT and media upload for the demo board, and cannot import into it', async () => {
    const headers = await bearer({ sub: 'slp-1', roles: ['voxa:editor'], org_id: 'org-1' });
    assert.equal((await putBoard(DEMO_BOARD_ID, headers)).status, 403);

    // Imports never write into an existing board: the old in-place endpoint is gone.
    const imported = await app.request(`/v1/boards/${DEMO_BOARD_ID}/import/obf`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'text/plain' },
      body: '{}',
    });
    assert.equal(imported.status, 410);

    const form = new FormData();
    form.set('boardId', DEMO_BOARD_ID);
    form.set('file', new File([new Uint8Array([1, 2, 3])], 'clip.webm', { type: 'audio/webm' }));
    const { Authorization } = headers;
    const upload = await app.request('/v1/media', {
      method: 'POST',
      headers: { Authorization: Authorization! },
      body: form,
    });
    assert.equal(upload.status, 403);

    // Still readable by everyone.
    assert.equal((await getBoard(DEMO_BOARD_ID, headers)).status, 200);
  });

  it('(5) POST /v1/sync/events no longer exists', async () => {
    const headers = await bearer({ sub: 'user-c', roles: ['voxa:admin'], org_id: 'org-1' });
    const res = await app.request('/v1/sync/events', {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: [] }),
    });
    assert.equal(res.status, 404);
    const read = await app.request('/v1/sync/events/org1-board', { headers });
    assert.equal(read.status, 404);
  });

  it('(6) a PUT cannot change ownerUserId or orgId, and the owner keeps access', async () => {
    const headers = await bearer({ sub: 'user-a', roles: [], org_id: 'org-a' });
    const res = await putBoard('victim-board', headers, { ownerUserId: 'x', orgId: 'y' });
    assert.equal(res.status, 200);
    const stored = (await store.getStore().getBoard('victim-board')) as Board;
    assert.equal(stored.ownerUserId, 'user-a');
    assert.equal(stored.orgId, 'org-a');
    assert.equal((await getBoard('victim-board', headers)).status, 200);

    // Omitting the fields does not wipe them either.
    const current = { ...stored } as Partial<Board>;
    delete current.ownerUserId;
    delete current.orgId;
    const omitted = await app.request('/v1/boards/victim-board', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...current, expectedVersion: stored.version }),
    });
    assert.equal(omitted.status, 200);
    const after = (await store.getStore().getBoard('victim-board')) as Board;
    assert.equal(after.ownerUserId, 'user-a');
    assert.equal(after.orgId, 'org-a');
  });

  it('(8a) a communicator can create a board they own, org from the token only', async () => {
    const headers = await bearer({ sub: 'family-1', roles: [], org_id: 'org-family' });
    const res = await app.request('/v1/boards', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: 'family-board',
        name: 'Family',
        profileId: 'default',
        version: 1,
        updatedAt: new Date().toISOString(),
        grid: { rows: 2, columns: 2, buttons: [] },
        ownerUserId: 'someone-else',
        orgId: 'org-1',
      }),
    });
    assert.equal(res.status, 201);
    const { board } = (await res.json()) as { board: Board };
    assert.equal(board.ownerUserId, 'family-1');
    assert.equal(board.orgId, 'org-family');

    // (8b) and then save it.
    assert.equal((await putBoard('family-board', headers)).status, 200);
  });

  it('(8a) a token without org_id creates a board with no organization', async () => {
    const headers = await bearer({ sub: 'family-2', roles: [] });
    const res = await app.request('/v1/boards', {
      method: 'POST',
      headers,
      body: JSON.stringify({ templateId: 'core-47', id: 'family-2-board', name: 'Mine', profileId: 'p', orgId: 'org-1' }),
    });
    assert.equal(res.status, 201);
    const { board } = (await res.json()) as { board: Board };
    assert.equal(board.ownerUserId, 'family-2');
    assert.equal(board.orgId, undefined);
    // An org-1 admin cannot reach it through the body-supplied org.
    const admin = await bearer({ sub: 'admin-1', roles: ['voxa:admin'], org_id: 'org-1' });
    assert.equal((await getBoard('family-2-board', admin)).status, 403);
  });

  it('rejects a token signed by another key', async () => {
    const other = await generateKeyPair('RS256');
    const forged = await new SignJWT({ sub: 'user-a', roles: ['voxa:admin'] })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(other.privateKey);
    const res = await getBoard('victim-board', { Authorization: `Bearer ${forged}` });
    assert.equal(res.status, 401);
  });
});

describe('development identity headers fail closed', () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, VOXA_DEV_AUTH: process.env.VOXA_DEV_AUTH };

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('(7) NODE_ENV=production without VOXA_DEV_AUTH: X-Voxa-Role: admin → 401', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VOXA_DEV_AUTH;
    const res = await app.request('/v1/boards', {
      headers: { 'X-Voxa-User-Id': 'user-a', 'X-Voxa-Role': 'admin' },
    });
    assert.equal(res.status, 401);
  });

  it('production ignores VOXA_DEV_AUTH=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VOXA_DEV_AUTH = 'true';
    const res = await app.request('/v1/boards', { headers: { 'X-Voxa-Role': 'admin' } });
    assert.equal(res.status, 401);
  });

  it('outside production the headers need VOXA_DEV_AUTH=true', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.VOXA_DEV_AUTH;
    assert.equal((await app.request('/v1/boards', { headers: { 'X-Voxa-Role': 'admin' } })).status, 401);
    process.env.VOXA_DEV_AUTH = 'true';
    assert.equal((await app.request('/v1/boards', { headers: { 'X-Voxa-Role': 'admin' } })).status, 200);
  });

  it('production CORS does not allow the development headers', async () => {
    process.env.NODE_ENV = 'production';
    const preflight = await app.request('/v1/boards', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://voxa.madfam.io',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,x-voxa-role',
      },
    });
    const allowed = (preflight.headers.get('Access-Control-Allow-Headers') ?? '').toLowerCase();
    assert.ok(allowed.includes('authorization'));
    assert.ok(!allowed.includes('x-voxa-role'));
    assert.ok(!allowed.includes('x-voxa-user-id'));
  });
});
