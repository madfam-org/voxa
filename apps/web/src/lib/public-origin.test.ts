/**
 * The public origin Auth.js and sign-out build their URLs on.
 *
 * Production incident this guards: the standalone server, bound to 0.0.0.0
 * behind the tunnel, handed route handlers `https://0.0.0.0:3000/...`, and the
 * Janua callback redirected every sign-in to
 * `https://0.0.0.0:3000/auth/signin?error=Configuration`. These tests run the
 * real exported Auth.js handlers (`src/auth.ts`) with request URLs on the bind
 * address, as production sees them.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import { handlers } from '../auth';
import { startFakeJanua, type FakeJanua } from '../test-support/fake-janua';
import { resetJanuaCachesForTests } from './janua-oidc';
import {
  authPublicHosts,
  invalidPublicHostEntries,
  isAllowedPublicHost,
  resolvePublicOrigin,
  withOrigin,
  withPublicOrigin,
} from './public-origin';
import { isSameOriginRequest } from './same-origin';
import { signOutResponse } from './sign-out';

const BIND = 'http://0.0.0.0:3000';
const LANDING = 'voxa.madfam.io';
const APP = 'voxa-app.madfam.io';
const PUBLIC_HOSTS = `${LANDING},${APP}`;

let janua: FakeJanua;
let env: Record<string, string>;
const saved: Record<string, string | undefined> = {};

function boundRequest(
  path: string,
  headers: Record<string, string>,
  init: { method?: string; body?: string } = {},
): NextRequest {
  return new NextRequest(`${BIND}${path}`, { ...init, headers });
}

type Providers = Record<string, { callbackUrl: string; signinUrl: string } | undefined>;

/** What the tunnel sends for a browser on `host`. */
function viaTunnel(host: string): Record<string, string> {
  return { Host: host, 'X-Forwarded-Host': host, 'X-Forwarded-Proto': 'https' };
}

before(async () => {
  janua = await startFakeJanua();
  env = {
    AUTH_SECRET: 'test-only-auth-secret-0123456789abcdef',
    AUTH_JANUA_ISSUER: janua.issuer,
    AUTH_JANUA_CLIENT_ID: 'voxa-test-client',
    AUTH_JANUA_CLIENT_SECRET: 'voxa-test-client-secret',
    NEXT_PUBLIC_BASE_URL: `https://${LANDING}`,
    AUTH_PUBLIC_HOSTS: PUBLIC_HOSTS,
  };
  for (const key of [...Object.keys(env), 'AUTH_URL', 'NEXTAUTH_URL']) saved[key] = process.env[key];
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
  Object.assign(process.env, env);
});

after(async () => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await janua.close();
});

beforeEach(() => {
  resetJanuaCachesForTests();
  delete process.env.AUTH_URL;
});

describe('Auth.js handlers on the public origin (server bound to 0.0.0.0)', () => {
  for (const host of [LANDING, APP]) {
    it(`/api/auth/providers on ${host} reports the callback on ${host}`, async () => {
      const res = await handlers.GET(boundRequest('/api/auth/providers', viaTunnel(host)));
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.ok(!text.includes('0.0.0.0'), text);
      const body = JSON.parse(text) as Providers;
      assert.equal(body.janua?.callbackUrl, `https://${host}/api/auth/callback/janua`);
      assert.equal(body.janua?.signinUrl, `https://${host}/api/auth/signin/janua`);
    });
  }

  it('uses only the first X-Forwarded-Host value', async () => {
    const res = await handlers.GET(
      boundRequest('/api/auth/providers', {
        Host: '10.0.0.5:3000',
        'X-Forwarded-Host': `${APP}, attacker.example`,
        'X-Forwarded-Proto': 'https',
      }),
    );
    const body = (await res.json()) as Providers;
    assert.equal(body.janua?.callbackUrl, `https://${APP}/api/auth/callback/janua`);
  });

  it('the anonymous callback error redirect stays on the public host', async () => {
    for (const host of [LANDING, APP]) {
      const res = await handlers.GET(boundRequest('/api/auth/callback/janua?code=probe&state=probe', viaTunnel(host)));
      assert.equal(res.status, 302);
      const location = res.headers.get('location') ?? '';
      assert.ok(!location.includes('0.0.0.0'), location);
      const url = new URL(location);
      assert.equal(url.origin, `https://${host}`);
      assert.equal(url.pathname, '/auth/signin');
      assert.ok(url.searchParams.get('error'), location);
    }
  });

  it('never uses a host outside the allow-list: 400, and nothing names it', async () => {
    const forged: Array<Record<string, string>> = [
      { Host: 'attacker.example', 'X-Forwarded-Proto': 'https' },
      { Host: LANDING, 'X-Forwarded-Host': 'attacker.example', 'X-Forwarded-Proto': 'https' },
      { Host: `${LANDING}.attacker.example` },
      {},
    ];
    for (const headers of forged) {
      for (const path of ['/api/auth/providers', '/api/auth/callback/janua?code=x&state=y', '/api/auth/csrf']) {
        const res = await handlers.GET(boundRequest(path, headers));
        assert.equal(res.status, 400, `${path} ${JSON.stringify(headers)}`);
        const text = await res.text();
        assert.ok(!text.includes('attacker'), text);
        assert.equal(res.headers.get('location'), null);
      }
    }
  });

  it('a host outside the allow-list falls back to AUTH_URL when it is set', async () => {
    process.env.AUTH_URL = `https://${LANDING}`;
    const res = await handlers.GET(boundRequest('/api/auth/providers', viaTunnel('attacker.example')));
    assert.equal(res.status, 200);
    const body = (await res.json()) as Providers;
    assert.equal(body.janua?.callbackUrl, `https://${LANDING}/api/auth/callback/janua`);
  });

  it('POST keeps its method, headers and body on the rebuilt request', async () => {
    let seen: { url: string; method: string; body: string; cookie: string | null } | undefined;
    const wrapped = withPublicOrigin(
      async (req) => {
        seen = { url: req.url, method: req.method, body: await req.text(), cookie: req.headers.get('cookie') };
        return new Response(null, { status: 204 });
      },
      () => env,
    );
    const res = await wrapped(
      boundRequest('/api/auth/signout?x=1', { ...viaTunnel(APP), cookie: 'a=b' }, { method: 'POST', body: 'csrfToken=t' }),
    );
    assert.equal(res.status, 204);
    assert.deepEqual(seen, {
      url: `https://${APP}/api/auth/signout?x=1`,
      method: 'POST',
      body: 'csrfToken=t',
      cookie: 'a=b',
    });
  });
});

describe('AUTH_URL and AUTH_PUBLIC_HOSTS both set (the transition: the manifest keeps the pin)', () => {
  const discovery = (async () => Response.json({ end_session_endpoint: `${janua.issuer}/logout` })) as unknown as typeof fetch;

  it('every allow-listed host stays pinned to AUTH_URL, as before this change', async () => {
    process.env.AUTH_URL = `https://${LANDING}`;
    const pinned = { ...env, AUTH_URL: `https://${LANDING}` };
    for (const host of [LANDING, APP]) {
      const providers = await handlers.GET(boundRequest('/api/auth/providers', viaTunnel(host)));
      assert.equal(providers.status, 200);
      const text = await providers.text();
      assert.ok(!text.includes('0.0.0.0'), text);
      const body = JSON.parse(text) as Providers;
      assert.equal(body.janua?.callbackUrl, `https://${LANDING}/api/auth/callback/janua`);
      assert.equal(body.janua?.signinUrl, `https://${LANDING}/api/auth/signin/janua`);

      const callback = await handlers.GET(boundRequest('/api/auth/callback/janua?code=probe&state=probe', viaTunnel(host)));
      assert.equal(callback.status, 302);
      const location = new URL(callback.headers.get('location') ?? '');
      assert.equal(location.origin, `https://${LANDING}`);
      assert.equal(location.pathname, '/auth/signin');

      const signOutReq = boundRequest('/auth/signout', { ...viaTunnel(host), Origin: `https://${host}` }, { method: 'POST' });
      assert.equal(isSameOriginRequest(signOutReq, pinned), true);
      const signOut = await signOutResponse(signOutReq, {
        sameOrigin: true,
        idToken: async () => 'id',
        env: pinned,
        fetchImpl: discovery,
      });
      assert.equal(signOut.status, 303);
      assert.equal(
        new URL(signOut.headers.get('location') ?? '').searchParams.get('post_logout_redirect_uri'),
        `https://${LANDING}/auth/signin`,
      );
    }
  });

  it('the readiness probe stays ready with both set', async () => {
    const { GET } = await import('../app/api/health/ready/route');
    process.env.AUTH_URL = `https://${LANDING}`;
    assert.equal((await GET()).status, 200);
  });
});

describe('resolvePublicOrigin', () => {
  const headers = (h: Record<string, string>) => new Headers(h);

  it('defaults the scheme to https for a public host and http for loopback', () => {
    assert.deepEqual(resolvePublicOrigin(headers({ Host: APP }), env), {
      ok: true,
      origin: `https://${APP}`,
      source: 'request',
    });
    assert.deepEqual(resolvePublicOrigin(headers({ Host: 'localhost:3207' }), { NEXT_PUBLIC_BASE_URL: 'http://localhost:3000' }), {
      ok: true,
      origin: 'http://localhost:3207',
      source: 'request',
    });
  });

  it('honours X-Forwarded-Proto http/https only', () => {
    const http = resolvePublicOrigin(headers({ Host: APP, 'X-Forwarded-Proto': 'http' }), env);
    assert.deepEqual(http, { ok: true, origin: `http://${APP}`, source: 'request' });
    const odd = resolvePublicOrigin(headers({ Host: APP, 'X-Forwarded-Proto': 'javascript' }), env);
    assert.deepEqual(odd, { ok: true, origin: `https://${APP}`, source: 'request' });
  });

  it('refuses malformed hosts', () => {
    for (const host of [`${LANDING}/evil`, `user@${LANDING}`, `${LANDING}:99999`, '', ' ']) {
      const result = resolvePublicOrigin(headers({ 'X-Forwarded-Host': host, Host: 'nope.example' }), env);
      assert.equal(result.ok, false, host);
    }
  });

  it('without AUTH_PUBLIC_HOSTS allows the NEXT_PUBLIC_BASE_URL host and loopback only', () => {
    const local = { NEXT_PUBLIC_BASE_URL: 'https://voxa.example.test' };
    assert.deepEqual(authPublicHosts(local), ['voxa.example.test', 'localhost', '127.0.0.1', '[::1]']);
    assert.equal(isAllowedPublicHost('voxa.example.test', local), true);
    assert.equal(isAllowedPublicHost('127.0.0.1:3000', local), true);
    assert.equal(isAllowedPublicHost(APP, local), false);
  });

  it('with AUTH_PUBLIC_HOSTS allows exactly that list (no loopback), case-insensitive', () => {
    assert.deepEqual(authPublicHosts(env), [LANDING, APP]);
    assert.equal(isAllowedPublicHost('localhost:3000', env), false);
    assert.equal(resolvePublicOrigin(headers({ Host: 'VOXA-APP.MADFAM.IO' }), env).ok, true);
  });

  it('an entry with a port matches that port only', () => {
    const local = { AUTH_PUBLIC_HOSTS: 'localhost:3207' };
    assert.equal(isAllowedPublicHost('localhost:3207', local), true);
    assert.equal(isAllowedPublicHost('localhost:3000', local), false);
    assert.equal(isAllowedPublicHost('localhost', local), false);
  });

  it('names malformed AUTH_PUBLIC_HOSTS entries', () => {
    assert.deepEqual(invalidPublicHostEntries({ AUTH_PUBLIC_HOSTS: 'a.example, https://b.example, c.example/x' }), [
      'https://b.example',
      'c.example/x',
    ]);
    assert.deepEqual(invalidPublicHostEntries(env), []);
  });

  it('withOrigin moves only the origin', () => {
    const moved = withOrigin(new Request(`${BIND}/api/auth/callback/janua?code=a&state=b`), `https://${APP}`);
    assert.equal(moved.url, `https://${APP}/api/auth/callback/janua?code=a&state=b`);
  });
});

describe('sign-out and the same-origin check use the allow-listed public host', () => {
  const discovery = (async () => Response.json({ end_session_endpoint: `${janua.issuer}/logout` })) as unknown as typeof fetch;

  it('sign-out returns to the sign-in page of the allow-listed host the browser used', async () => {
    const req = boundRequest('/auth/signout', { ...viaTunnel(APP), Origin: `https://${APP}` }, { method: 'POST' });
    assert.equal(isSameOriginRequest(req, env), true);
    const res = await signOutResponse(req, { sameOrigin: true, idToken: async () => 'id', env, fetchImpl: discovery });
    assert.equal(res.status, 303);
    const location = res.headers.get('location') ?? '';
    assert.ok(!location.includes('0.0.0.0'), location);
    assert.equal(new URL(location).searchParams.get('post_logout_redirect_uri'), `https://${APP}/auth/signin`);
  });

  it('sign-out on a host outside the allow-list answers 400 without AUTH_URL', async () => {
    const req = boundRequest('/auth/signout', viaTunnel('attacker.example'), { method: 'POST' });
    const res = await signOutResponse(req, { sameOrigin: true, idToken: async () => 'id', env, fetchImpl: discovery });
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('location'), null);
  });

  it('the same-origin check refuses an Origin that matches a host outside the allow-list', () => {
    const req = boundRequest('/api/v1/boards', { ...viaTunnel('attacker.example'), Origin: 'https://attacker.example' }, { method: 'POST' });
    assert.equal(isSameOriginRequest(req, env), false);
  });

  it('the same-origin check never trusts the bind-address origin of the request URL', () => {
    const req = boundRequest('/api/v1/boards', { Origin: BIND }, { method: 'POST' });
    assert.equal(isSameOriginRequest(req, env), false);
  });
});
