import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { signOutResponse } from './sign-out';
import { isSameOriginRequest } from './same-origin';

const ORIGIN = 'https://voxa.example.test';
const ISSUER = 'https://janua.example.test';
const env = {
  AUTH_URL: ORIGIN,
  AUTH_SECRET: 's',
  AUTH_JANUA_ISSUER: ISSUER,
  AUTH_JANUA_CLIENT_ID: 'voxa-client',
  AUTH_JANUA_CLIENT_SECRET: 'cs',
};
const discovery = (async () =>
  Response.json({ end_session_endpoint: `${ISSUER}/logout` })) as unknown as typeof fetch;

function post(headers: Record<string, string>): Request {
  return new Request(`${ORIGIN}/auth/signout`, { method: 'POST', headers });
}

describe('sign-out (RP-initiated logout)', () => {
  it('GET answers 405', async () => {
    const res = await signOutResponse(new Request(`${ORIGIN}/auth/signout`), {
      sameOrigin: true,
      idToken: async () => 'id-token',
      env,
      fetchImpl: discovery,
    });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'POST');
  });

  it('refuses a cross-origin POST', async () => {
    const req = post({ Origin: 'https://evil.example' });
    const res = await signOutResponse(req, {
      sameOrigin: isSameOriginRequest(req, env),
      idToken: async () => 'id-token',
      env,
      fetchImpl: discovery,
    });
    assert.equal(res.status, 403);
  });

  it('POST clears every session cookie chunk and 303s to Janua end_session with id_token_hint and post_logout_redirect_uri', async () => {
    const req = post({
      Origin: ORIGIN,
      cookie: '__Secure-authjs.session-token.0=v1.AAA; __Secure-authjs.session-token.1=BBB; other=keep',
    });
    const res = await signOutResponse(req, {
      sameOrigin: isSameOriginRequest(req, env),
      idToken: async () => 'id-token-value',
      env,
      fetchImpl: discovery,
    });
    assert.equal(res.status, 303);
    const location = new URL(res.headers.get('location')!);
    assert.equal(`${location.origin}${location.pathname}`, `${ISSUER}/logout`);
    assert.equal(location.searchParams.get('id_token_hint'), 'id-token-value');
    assert.equal(location.searchParams.get('post_logout_redirect_uri'), `${ORIGIN}/auth/signin`);
    assert.equal(location.searchParams.get('client_id'), 'voxa-client');

    const cleared = res.headers.getSetCookie();
    for (const name of [
      '__Secure-authjs.session-token',
      '__Secure-authjs.session-token.0',
      '__Secure-authjs.session-token.1',
    ]) {
      const line = cleared.find((l) => l.startsWith(`${name}=;`));
      assert.ok(line, `${name} cleared`);
      assert.match(line!, /Max-Age=0/);
      assert.match(line!, /Secure/);
    }
    assert.ok(!cleared.some((l) => l.startsWith('other=')));
  });

  it('still ends the Janua session when the Voxa session already expired', async () => {
    const req = post({ Origin: ORIGIN });
    const res = await signOutResponse(req, {
      sameOrigin: true,
      idToken: async () => undefined,
      env,
      fetchImpl: discovery,
    });
    assert.equal(res.status, 303);
    const location = new URL(res.headers.get('location')!);
    assert.equal(location.searchParams.get('id_token_hint'), null);
    assert.equal(location.searchParams.get('post_logout_redirect_uri'), `${ORIGIN}/auth/signin`);
  });

  it('without a configured public origin, returns to the sign-in page of the host the browser used', async () => {
    const { AUTH_URL: _unused, ...local } = env;
    const req = new Request('http://0.0.0.0:3000/auth/signout', {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:3000', Host: '127.0.0.1:3000' },
    });
    const res = await signOutResponse(req, { sameOrigin: true, idToken: async () => 'id', env: local, fetchImpl: discovery });
    const location = new URL(res.headers.get('location')!);
    assert.equal(location.searchParams.get('post_logout_redirect_uri'), 'http://127.0.0.1:3000/auth/signin');
  });

  it('a configured public origin wins over the Host header', async () => {
    const req = new Request(`${ORIGIN}/auth/signout`, {
      method: 'POST',
      headers: { Origin: ORIGIN, Host: 'attacker.example' },
    });
    const res = await signOutResponse(req, { sameOrigin: true, idToken: async () => 'id', env, fetchImpl: discovery });
    const location = new URL(res.headers.get('location')!);
    assert.equal(location.searchParams.get('post_logout_redirect_uri'), `${ORIGIN}/auth/signin`);
  });
});
