import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createVoxaClient } from './index.js';

const realFetch = globalThis.fetch;

describe('VoxaClient through the web app’s same-origin proxy', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function recordFetch(body: unknown) {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    return calls;
  }

  it('sends neither a bearer nor development identity headers', async () => {
    const calls = recordFetch({ boards: [] });
    const client = createVoxaClient({ baseUrl: '/api', sameOriginSession: true, userId: 'u', role: 'admin' });
    await client.listBoards();
    assert.equal(calls[0]!.url, '/api/v1/boards');
    const headers = calls[0]!.init!.headers as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
    assert.equal(headers['X-Voxa-User-Id'], undefined);
    assert.equal(headers['X-Voxa-Role'], undefined);
  });

  it('mints WebSocket tickets with a POST through the proxy', async () => {
    const calls = recordFetch({ ticket: 'T'.repeat(43), expiresAt: '2026-10-04T00:00:30.000Z' });
    const client = createVoxaClient({ baseUrl: '/api', sameOriginSession: true });
    assert.equal(await client.createWsTicket(), 'T'.repeat(43));
    assert.equal(calls[0]!.url, '/api/v1/ws-ticket');
    assert.equal(calls[0]!.init!.method, 'POST');
  });

  it('native clients keep their own bearer', async () => {
    const calls = recordFetch({ boards: [] });
    const client = createVoxaClient({ baseUrl: 'https://api.example.test', accessToken: 'native-token' });
    await client.listBoards();
    assert.equal((calls[0]!.init!.headers as Record<string, string>).Authorization, 'Bearer native-token');
  });
});
