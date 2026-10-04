import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Hono } from 'hono';
import { resolveWsTeam, wsTicketGate } from './ws-auth.js';
import {
  closeAtTokenExpiry,
  consumeWsTicket,
  mintWsTicket,
  resetMemoryWsTicketsForTests,
  WS_TICKET_TTL_MS,
} from './ws-tickets.js';

const TEAM = { userId: 'user-a', role: 'editor' as const, orgId: 'org-1' };

function gatedApp() {
  const app = new Hono();
  app.get('/ws', wsTicketGate(), (c) => c.json(c.get('wsGrant')));
  return app;
}

describe('WebSocket tickets (file-store driver, in memory)', () => {
  // The test preload turns the development identity shortcut on; these
  // checks are about the production path, where it is off.
  const savedDevAuth = process.env.VOXA_DEV_AUTH;
  beforeEach(() => {
    resetMemoryWsTicketsForTests();
    delete process.env.VOXA_DEV_AUTH;
  });
  afterEach(() => {
    if (savedDevAuth === undefined) delete process.env.VOXA_DEV_AUTH;
    else process.env.VOXA_DEV_AUTH = savedDevAuth;
  });

  it('a ticket opens once; the second use is refused with 401', async () => {
    const tokenExp = Math.floor(Date.now() / 1000) + 600;
    const minted = await mintWsTicket({ ...TEAM, tokenExp });
    assert.ok(minted);
    const app = gatedApp();

    const first = await app.request(`/ws?boardId=b1&ticket=${minted.ticket}`);
    assert.equal(first.status, 200);
    const grant = (await first.json()) as { userId: string; role: string; orgId: string; tokenExpiresAt: number };
    assert.deepEqual(grant, { userId: 'user-a', role: 'editor', orgId: 'org-1', tokenExpiresAt: tokenExp * 1000 });

    const second = await app.request(`/ws?boardId=b1&ticket=${minted.ticket}`);
    assert.equal(second.status, 401);
  });

  it('an expired ticket is refused with 401', async () => {
    const tokenExp = Math.floor(Date.now() / 1000) + 600;
    const minted = await mintWsTicket(
      { ...TEAM, tokenExp },
      { now: Date.now() - WS_TICKET_TTL_MS - 1000 },
    );
    assert.ok(minted);
    const res = await gatedApp().request(`/ws?boardId=b1&ticket=${minted.ticket}`);
    assert.equal(res.status, 401);
  });

  it('expires 30 seconds after minting', async () => {
    const now = Date.parse('2026-10-04T12:00:00.000Z');
    const minted = await mintWsTicket({ ...TEAM, tokenExp: now / 1000 + 600 }, { now });
    assert.equal(minted?.expiresAt, '2026-10-04T12:00:30.000Z');
    assert.equal(await consumeWsTicket(minted!.ticket, { now: now + 30_000 }), null);
  });

  it('refuses to mint from a token that is already past its exp', async () => {
    const minted = await mintWsTicket({ ...TEAM, tokenExp: Math.floor(Date.now() / 1000) - 5 });
    assert.equal(minted, null);
  });

  it('never accepts an access token in the URL', async () => {
    const res = await gatedApp().request('/ws?boardId=b1&accessToken=eyJhbGciOiJSUzI1NiJ9.e30.sig');
    assert.equal(res.status, 401);
  });

  it('rejects malformed and unknown tickets', async () => {
    const app = gatedApp();
    assert.equal((await app.request('/ws?ticket=short')).status, 401);
    assert.equal((await app.request(`/ws?ticket=${'A'.repeat(43)}`)).status, 401);
  });
});

describe('closeAtTokenExpiry', () => {
  it('closes the socket with 4401 when the source token expires', () => {
    const closed: Array<[number, string]> = [];
    let scheduled: { fn: () => void; ms: number } | null = null;
    closeAtTokenExpiry((code, reason) => closed.push([code, reason]), 1_000_000 + 45_000, {
      now: 1_000_000,
      setTimer: (fn, ms) => {
        scheduled = { fn, ms };
        return 1;
      },
      clearTimer: () => undefined,
    });
    assert.equal(scheduled!.ms, 45_000);
    assert.deepEqual(closed, []);
    scheduled!.fn();
    assert.deepEqual(closed, [[4401, 'Token expired']]);
  });

  it('cancels the timer when the socket closes first', () => {
    let cleared = false;
    const cancel = closeAtTokenExpiry(() => assert.fail('must not close'), 5_000, {
      now: 0,
      setTimer: () => 7,
      clearTimer: (handle) => {
        cleared = handle === 7;
      },
    });
    cancel();
    assert.equal(cleared, true);
  });
});

describe('the WebSocket accepts only tickets', () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, VOXA_DEV_AUTH: process.env.VOXA_DEV_AUTH };

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('ignores ?userId=&role= even with VOXA_DEV_AUTH=true outside production', async () => {
    process.env.NODE_ENV = 'test';
    process.env.VOXA_DEV_AUTH = 'true';
    const res = await gatedApp().request('/ws?boardId=demo-core&userId=dev-a&role=editor');
    assert.equal(res.status, 401);
  });

  it('ignores an Authorization header on the upgrade', async () => {
    const res = await gatedApp().request('/ws?boardId=demo-core', {
      headers: { Authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.e30.sig' },
    });
    assert.equal(res.status, 401);
  });

  it('resolveWsTeam returns null without a ticket', async () => {
    const app = new Hono();
    app.get('/ws', async (c) => c.json(await resolveWsTeam(c)));
    assert.equal(await (await app.request('/ws?boardId=demo-core')).json(), null);
  });
});
