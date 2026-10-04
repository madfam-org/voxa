import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MEDIA_CACHE_CONTROL, proxyMediaRequest } from './media-proxy.js';

const API = 'https://voxa-api.example.test';
const OWNED = '3f1c2a9e-7b4d-4c1e-9a8f-0d2b6e5c4a31';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

/**
 * Stand-in for `GET /v1/media/:id` that applies the API's rule by token:
 * the owner's token reads the asset, another user's token gets 403, an
 * unknown id 404. The proxy must pass each answer through unchanged.
 */
function fakeApi(calls: Array<{ url: string; headers: Headers }>): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, headers });
    const id = url.split('/v1/media/')[1];
    const auth = headers.get('Authorization');
    if (!auth) return new Response('{"error":"Authentication required"}', { status: 401 });
    if (id !== OWNED) return new Response('{"error":"Not found"}', { status: 404 });
    if (auth !== 'Bearer owner-token')
      return new Response('{"error":"Forbidden"}', { status: 403 });
    return new Response(PNG, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Content-Length': String(PNG.byteLength) },
    });
  }) as typeof fetch;
}

describe('media proxy (GET /api/media/:id)', () => {
  it('serves the owner with the session token, private cache and no-sniff', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const res = await proxyMediaRequest({
      id: OWNED,
      accessToken: 'owner-token',
      apiUrl: `${API}/`,
      fetchImpl: fakeApi(calls),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'image/png');
    assert.equal(res.headers.get('Cache-Control'), MEDIA_CACHE_CONTROL);
    assert.match(MEDIA_CACHE_CONTROL, /^private\b/);
    assert.equal(res.headers.get('Vary'), 'Cookie');
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), PNG);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, `${API}/v1/media/${OWNED}`);
    assert.equal(calls[0]!.headers.get('Authorization'), 'Bearer owner-token');
    assert.equal(calls[0]!.headers.get('Cookie'), null);
  });

  it("passes the API's 403 through for another user's token", async () => {
    const res = await proxyMediaRequest({
      id: OWNED,
      accessToken: 'other-user-token',
      apiUrl: API,
      fetchImpl: fakeApi([]),
    });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  });

  it("passes the API's 404 through for an unknown id", async () => {
    const res = await proxyMediaRequest({
      id: '00000000-0000-4000-8000-000000000000',
      accessToken: 'owner-token',
      apiUrl: API,
      fetchImpl: fakeApi([]),
    });
    assert.equal(res.status, 404);
  });

  it('answers 401 without a session and never calls the API', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const res = await proxyMediaRequest({
      id: OWNED,
      accessToken: undefined,
      apiUrl: API,
      fetchImpl: fakeApi(calls),
    });
    assert.equal(res.status, 401);
    assert.equal(calls.length, 0);
  });

  it('rejects ids that are not a single path segment before calling the API', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    for (const id of ['../boards', 'a/b', '', 'x'.repeat(200)]) {
      const res = await proxyMediaRequest({
        id,
        accessToken: 'owner-token',
        apiUrl: API,
        fetchImpl: fakeApi(calls),
      });
      assert.equal(res.status, 404, id);
    }
    assert.equal(calls.length, 0);
  });

  it('turns API failures and non-media answers into 502', async () => {
    const failing = (async () => new Response('boom', { status: 503 })) as typeof fetch;
    assert.equal(
      (await proxyMediaRequest({ id: OWNED, accessToken: 't', apiUrl: API, fetchImpl: failing }))
        .status,
      502,
    );
    const html = (async () =>
      new Response('<html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })) as typeof fetch;
    assert.equal(
      (await proxyMediaRequest({ id: OWNED, accessToken: 't', apiUrl: API, fetchImpl: html }))
        .status,
      502,
    );
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    assert.equal(
      (await proxyMediaRequest({ id: OWNED, accessToken: 't', apiUrl: API, fetchImpl: down }))
        .status,
      502,
    );
  });
});
