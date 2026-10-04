/**
 * `POST /v1/ws-ticket` and the ticket gate on `GET /v1/ws`, through the real
 * app with real RS256 access tokens (file-store driver).
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { decodeJwt } from 'jose';
import app from '../app.js';
import { resetMemoryWsTicketsForTests } from '../lib/ws-tickets.js';
import * as fileStore from '../store/file-board-store.js';
import * as store from '../store/index.js';
import { startTestTokenIssuer, type TestTokenIssuer } from '../test-support/janua-tokens.js';

describe('WebSocket tickets through the API', () => {
  let issuer: TestTokenIssuer;

  before(async () => {
    delete process.env.VOXA_DEV_AUTH;
    issuer = await startTestTokenIssuer();
  });

  after(async () => {
    await issuer.close();
  });

  beforeEach(async () => {
    resetMemoryWsTicketsForTests();
    const fresh = fileStore.createFileBoardStore();
    await fresh.resetStoreForTests?.();
    store.useTestStore(fresh);
  });

  it('needs a bearer token', async () => {
    const res = await app.request('/v1/ws-ticket', { method: 'POST' });
    assert.equal(res.status, 401);
  });

  it('mints a no-store ticket valid for 30 seconds, usable once on /v1/ws', async () => {
    const headers = await issuer.bearer({ sub: 'user-ticket', roles: ['voxa:editor'] });
    const res = await app.request('/v1/ws-ticket', { method: 'POST', headers });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    const body = (await res.json()) as { ticket: string; expiresAt: string };
    assert.match(body.ticket, /^[A-Za-z0-9_-]{43}$/);
    const ttl = Date.parse(body.expiresAt) - Date.now();
    assert.ok(ttl > 25_000 && ttl <= 30_000, `ttl ${ttl}`);
    assert.ok(!body.ticket.startsWith('eyJ'), 'the ticket is not the token');

    // Not a WebSocket upgrade here, so a ticket that passes the gate reaches
    // the upgrade helper, which answers anything but 401.
    const first = await app.request(`/v1/ws?boardId=demo-core&ticket=${body.ticket}`);
    assert.notEqual(first.status, 401);
    const second = await app.request(`/v1/ws?boardId=demo-core&ticket=${body.ticket}`);
    assert.equal(second.status, 401);
  });

  it('binds the ticket to the token exp so the socket can close at it', async () => {
    const headers = await issuer.bearer({ sub: 'user-exp' });
    const token = headers.Authorization!.slice('Bearer '.length);
    const exp = decodeJwt(token).exp!;
    const { mintWsTicket, consumeWsTicket } = await import('../lib/ws-tickets.js');
    const minted = await mintWsTicket({ userId: 'user-exp', role: 'communicator', tokenExp: exp });
    const grant = await consumeWsTicket(minted!.ticket);
    assert.equal(grant?.tokenExpiresAt, exp * 1000);
  });

  it('refuses the old ?accessToken= on /v1/ws', async () => {
    const headers = await issuer.bearer({ sub: 'user-url' });
    const token = headers.Authorization!.slice('Bearer '.length);
    const res = await app.request(`/v1/ws?boardId=demo-core&accessToken=${token}`);
    assert.equal(res.status, 401);
  });
});
