/**
 * The real Auth.js session endpoint and server-side session reader, with an
 * in-process Janua: what page scripts can see, what the cookie holds, and
 * refresh-token rotation (success and a clean sign-out on failure).
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { buildAuthConfig } from '../auth';
import { startFakeJanua, type FakeJanua } from '../test-support/fake-janua';
import { resetJanuaCachesForTests } from './janua-oidc';
import { readServerSession } from './server-session';
import { mintSessionCookieValue } from './session-mint';

const SECRET = 'test-only-auth-secret-0123456789abcdef';
const COOKIE = 'authjs.session-token';
const ORIGIN = 'http://localhost:3000';

let janua: FakeJanua;
let env: Record<string, string>;
let handlers: ReturnType<typeof NextAuth>['handlers'];

function setCookieValue(lines: string[], name: string): string | undefined {
  const line = lines.find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).split(';')[0];
}

async function sessionCookie(overrides: Record<string, unknown> = {}): Promise<string> {
  const accessToken = await janua.accessToken({ sub: 'user-1', email: 'one@example.test', roles: ['voxa:editor'] });
  return mintSessionCookieValue({
    secret: SECRET,
    cookieName: COOKIE,
    token: {
      userId: 'user-1',
      name: 'User One',
      email: 'one@example.test',
      teamRole: 'editor',
      accessToken,
      refreshToken: 'refresh-1',
      idToken: 'id-token-1',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    },
  });
}

function sessionRequest(cookie: string): NextRequest {
  return new NextRequest(`${ORIGIN}/api/auth/session`, { headers: { cookie: `${COOKIE}=${cookie}` } });
}

before(async () => {
  janua = await startFakeJanua();
  env = {
    AUTH_SECRET: SECRET,
    AUTH_JANUA_ISSUER: janua.issuer,
    AUTH_JANUA_CLIENT_ID: 'voxa-test-client',
    AUTH_JANUA_CLIENT_SECRET: 'voxa-test-client-secret',
    NEXT_PUBLIC_BASE_URL: ORIGIN,
  };
  Object.assign(process.env, env);
  handlers = NextAuth(() => buildAuthConfig(env)).handlers;
});

after(async () => {
  for (const key of Object.keys(env)) delete process.env[key];
  await janua.close();
});

beforeEach(() => {
  resetJanuaCachesForTests();
  janua.setRefreshAnswer(null);
  janua.tokenRequests.length = 0;
});

describe('GET /api/auth/session (what page scripts see)', () => {
  it('returns identity and role only: no token key and no JWT anywhere', async () => {
    const res = await handlers.GET(sessionRequest(await sessionCookie()));
    assert.equal(res.status, 200);
    const text = await res.text();
    const body = JSON.parse(text) as Record<string, unknown>;
    for (const key of ['accessToken', 'access_token', 'refreshToken', 'refresh_token', 'idToken', 'id_token']) {
      assert.ok(!text.includes(`"${key}"`), `${key} must not reach page scripts`);
    }
    assert.ok(!text.includes('eyJ'), 'no JWT in the session JSON');
    assert.deepEqual(body.user, { id: 'user-1', name: 'User One', email: 'one@example.test' });
    assert.equal(body.teamRole, 'editor');
  });

  it('keeps the session cookie free of any JWT-shaped string', async () => {
    const cookie = await sessionCookie();
    assert.ok(!cookie.includes('eyJ'));
    const res = await handlers.GET(sessionRequest(cookie));
    const rewritten = setCookieValue(res.headers.getSetCookie(), COOKIE);
    assert.ok(rewritten, 'Auth.js re-issues the cookie');
    assert.ok(!rewritten!.includes('eyJ'));
    for (const line of res.headers.getSetCookie()) assert.ok(!line.includes('eyJ'), line.split('=')[0]);
  });

  it('answers null for a cookie that was not minted with this secret', async () => {
    const forged = await mintSessionCookieValue({
      secret: 'another-secret-0123456789abcdef0123',
      cookieName: COOKIE,
      token: { userId: 'attacker', teamRole: 'admin', accessToken: 'x', expiresAt: 4102444800 },
    });
    const res = await handlers.GET(sessionRequest(forged));
    assert.equal(await res.json(), null);
  });

  it('the old plain-JSON cookie is not a session', async () => {
    const res = await handlers.GET(
      new NextRequest(`${ORIGIN}/api/auth/session`, {
        headers: { cookie: `voxa_session=${encodeURIComponent('{"access_token":"x","user_id":"u"}')}` },
      }),
    );
    assert.equal(await res.json(), null);
  });
});

describe('refresh-token rotation', () => {
  it('refreshes an access token that is about to expire and rotates the refresh token', async () => {
    const fresh = await janua.accessToken({ sub: 'user-1', roles: ['voxa:admin'] });
    janua.setRefreshAnswer({ access_token: fresh, refresh_token: 'refresh-2', expires_in: 3600, token_type: 'Bearer' });
    const cookie = await sessionCookie({ expiresAt: Math.floor(Date.now() / 1000) + 30 });

    const session = await readServerSession(
      new Request(`${ORIGIN}/api/v1/boards`, { headers: { cookie: `${COOKIE}=${cookie}` } }),
      { sessionHandler: handlers.GET, env },
    );
    assert.equal(janua.tokenRequests.length, 1);
    assert.match(janua.tokenRequests[0]!.body, /grant_type=refresh_token/);
    assert.match(janua.tokenRequests[0]!.body, /refresh_token=refresh-1/);
    assert.match(janua.tokenRequests[0]!.authorization ?? '', /^Basic /);
    assert.equal(session.token?.accessToken, fresh);
    assert.equal(session.token?.refreshToken, 'refresh-2');
    assert.equal(session.token?.teamRole, 'admin', 'role re-read from the verified new token');
    assert.equal(session.token?.idToken, 'id-token-1', 'id token kept for RP-logout');
    assert.ok(setCookieValue(session.setCookies, COOKIE), 'the rotated session is written back');
  });

  it('signs out cleanly when the refresh is refused', async () => {
    const cookie = await sessionCookie({ expiresAt: Math.floor(Date.now() / 1000) + 10 });
    const res = await handlers.GET(sessionRequest(cookie));
    assert.equal(await res.json(), null);
    const cleared = res.headers.getSetCookie().find((l) => l.startsWith(`${COOKIE}=`));
    assert.ok(cleared && /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(cleared), 'session cookie cleared');

    const session = await readServerSession(
      new Request(`${ORIGIN}/api/v1/boards`, { headers: { cookie: `${COOKIE}=${cookie}` } }),
      { sessionHandler: handlers.GET, env },
    );
    assert.equal(session.token, null);
  });

  it('refuses a refreshed token issued for another person', async () => {
    const other = await janua.accessToken({ sub: 'user-2' });
    janua.setRefreshAnswer({ access_token: other, refresh_token: 'refresh-x', expires_in: 3600 });
    const cookie = await sessionCookie({ expiresAt: Math.floor(Date.now() / 1000) + 10 });
    const res = await handlers.GET(sessionRequest(cookie));
    assert.equal(await res.json(), null);
  });

  it('does not call Janua while the access token is fresh', async () => {
    await handlers.GET(sessionRequest(await sessionCookie()));
    assert.equal(janua.tokenRequests.length, 0);
  });
});

describe('readServerSession', () => {
  it('gives route handlers the tokens of a valid session', async () => {
    const session = await readServerSession(
      new Request(`${ORIGIN}/api/v1/boards`, { headers: { cookie: `${COOKIE}=${await sessionCookie()}` } }),
      { sessionHandler: handlers.GET, env },
    );
    assert.equal(session.token?.userId, 'user-1');
    assert.match(session.token?.accessToken ?? '', /^eyJ/);
  });

  it('does nothing without a session cookie', async () => {
    let called = false;
    const session = await readServerSession(new Request(`${ORIGIN}/api/v1/boards`), {
      sessionHandler: async () => {
        called = true;
        return new Response('null');
      },
      env,
    });
    assert.deepEqual(session, { token: null, setCookies: [] });
    assert.equal(called, false);
  });
});
