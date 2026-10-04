import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PROXY_CACHE_CONTROL, proxyApiRequest, upstreamPath } from './api-proxy';
import { isSameOriginRequest } from './same-origin';

const ORIGIN = 'http://localhost:3000';
const API = 'http://api.internal.test:4000';

interface Call {
  url: string;
  init: RequestInit;
}

function recorder(answer: () => Response = () => Response.json({ ok: true })) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: URL | string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return answer();
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`${ORIGIN}${path}`, init);
}

async function run(req: Request, options: { token?: string; answer?: () => Response } = {}) {
  const { calls, fetchImpl } = recorder(options.answer);
  let tokenRead = false;
  const res = await proxyApiRequest({
    request: req,
    sameOrigin: isSameOriginRequest(req, { NEXT_PUBLIC_BASE_URL: ORIGIN }),
    apiUrl: API,
    fetchImpl,
    accessToken: async () => {
      tokenRead = true;
      return 'token' in options ? options.token : 'access-token-value';
    },
  });
  return { res, calls, tokenRead };
}

describe('same-origin API proxy', () => {
  it('forwards the bearer and never the cookie or development identity headers', async () => {
    const { res, calls } = await run(
      request('/api/v1/boards?limit=5', {
        headers: {
          cookie: 'authjs.session-token=v1.ABC',
          'X-Voxa-User-Id': 'someone-else',
          'X-Voxa-Role': 'admin',
          Accept: 'application/json',
        },
      }),
    );
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, `${API}/v1/boards?limit=5`);
    const headers = calls[0]!.init.headers as Headers;
    assert.equal(headers.get('authorization'), 'Bearer access-token-value');
    assert.equal(headers.get('cookie'), null);
    assert.equal(headers.get('x-voxa-user-id'), null);
    assert.equal(headers.get('x-voxa-role'), null);
    assert.equal(headers.get('accept'), 'application/json');
    assert.equal(res.headers.get('cache-control'), PROXY_CACHE_CONTROL);
  });

  it('refuses a cross-origin POST with 403 without calling the API', async () => {
    const { res, calls, tokenRead } = await run(
      request('/api/v1/boards', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' }),
    );
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
    assert.equal(tokenRead, false);
  });

  it('refuses a POST that names no origin at all', async () => {
    const { res, calls } = await run(request('/api/v1/boards', { method: 'POST', body: '{}' }));
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
  });

  it('accepts a same-origin POST and streams its body', async () => {
    const { res, calls } = await run(
      request('/api/v1/ws-ticket', {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: '{"a":1}',
      }),
    );
    assert.equal(res.status, 200);
    assert.equal(calls[0]!.url, `${API}/v1/ws-ticket`);
    assert.equal(calls[0]!.init.method, 'POST');
    assert.equal(await new Response(calls[0]!.init.body as BodyInit).text(), '{"a":1}');
  });

  it('accepts Sec-Fetch-Site: same-origin when Origin is absent', async () => {
    const { res } = await run(
      request('/api/v1/consents', { method: 'PUT', headers: { 'Sec-Fetch-Site': 'same-origin' }, body: '{}' }),
    );
    assert.equal(res.status, 200);
  });

  for (const path of [
    '/api/v1/../admin',
    '/api/v1/%2e%2e/admin',
    '/api/v1/boards/..%2Fadmin',
    '/api/v1//evil.example/x',
    '/api/v1/http:%2F%2Fevil.example',
    '/api/v1/boards/%2F%2Fevil.example',
    '/api/v2/boards',
    '/api/v1/',
  ]) {
    it(`rejects ${path} without calling the API`, async () => {
      const raw = new Request(`${ORIGIN}/placeholder`);
      // Build the URL by hand so nothing normalizes the path first.
      const req = new Request(raw, {});
      Object.defineProperty(req, 'url', { value: `${ORIGIN}${path}` });
      const { res, calls, tokenRead } = await run(req);
      assert.ok(res.status === 400 || res.status === 404, `status ${res.status}`);
      assert.equal(calls.length, 0);
      assert.equal(tokenRead, false);
    });
  }

  it('upstreamPath keeps the proxy inside /v1/', () => {
    assert.equal(upstreamPath(`${ORIGIN}/api/v1/boards/b-1/export/obz`), '/v1/boards/b-1/export/obz');
    assert.equal(upstreamPath('https://evil.example/api/v1/boards'), '/v1/boards');
    // Dot segments are resolved by URL parsing before the check, never passed on.
    assert.equal(upstreamPath(`${ORIGIN}/api/v1/boards/./x`), '/v1/boards/x');
    assert.equal(upstreamPath(`${ORIGIN}/api/v1/boards/../../admin`), null);
  });

  it('answers 401 without calling the API when there is no session', async () => {
    const { res, calls } = await run(request('/api/v1/boards'), { token: undefined });
    assert.equal(res.status, 401);
    assert.equal(calls.length, 0);
  });

  it('passes status and content type through and drops upstream cookies and hop-by-hop headers', async () => {
    const { res } = await run(request('/api/v1/boards/b-1/export/obf'), {
      answer: () =>
        new Response('obf', {
          status: 403,
          headers: {
            'Content-Type': 'application/vnd.openboard+json',
            'Set-Cookie': 'tracker=1',
            Connection: 'keep-alive',
            'Transfer-Encoding': 'chunked',
            'Content-Disposition': 'attachment; filename="b-1.obf"',
          },
        }),
    });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('content-type'), 'application/vnd.openboard+json');
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="b-1.obf"');
    assert.equal(res.headers.get('set-cookie'), null);
    assert.equal(res.headers.get('connection'), null);
    assert.equal(res.headers.get('transfer-encoding'), null);
    assert.equal(await res.text(), 'obf');
  });

  it('allows only the API methods', async () => {
    const { res, calls } = await run(request('/api/v1/boards', { method: 'OPTIONS' }));
    assert.equal(res.status, 405);
    assert.equal(calls.length, 0);
  });

  it('turns an unreachable API into 502', async () => {
    const req = request('/api/v1/boards');
    const res = await proxyApiRequest({
      request: req,
      sameOrigin: true,
      apiUrl: API,
      accessToken: async () => 't',
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as typeof fetch,
    });
    assert.equal(res.status, 502);
  });
});

describe('isSameOriginRequest', () => {
  const env = { NEXT_PUBLIC_BASE_URL: 'https://voxa.example.test' };

  it('accepts an Origin that matches the Host the browser used (server bound to 0.0.0.0)', () => {
    const req = new Request('http://0.0.0.0:3000/api/v1/boards', {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:3000', Host: '127.0.0.1:3000' },
    });
    assert.equal(isSameOriginRequest(req, env), true);
  });

  it('accepts the forwarded host behind a proxy when it is allow-listed (AUTH_PUBLIC_HOSTS)', () => {
    const req = new Request('http://0.0.0.0:3000/api/v1/boards', {
      method: 'POST',
      headers: { Origin: 'https://app.example.test', Host: '10.0.0.5:3000', 'X-Forwarded-Host': 'app.example.test' },
    });
    assert.equal(isSameOriginRequest(req, { ...env, AUTH_PUBLIC_HOSTS: 'voxa.example.test,app.example.test' }), true);
    assert.equal(isSameOriginRequest(req, env), false);
  });

  it('refuses another site even when it reaches the same host', () => {
    const req = new Request('http://0.0.0.0:3000/api/v1/boards', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', Host: '127.0.0.1:3000' },
    });
    assert.equal(isSameOriginRequest(req, env), false);
  });

  it('refuses Origin: null', () => {
    const req = new Request('http://127.0.0.1:3000/api/v1/boards', { method: 'POST', headers: { Origin: 'null' } });
    assert.equal(isSameOriginRequest(req, env), false);
  });
});
