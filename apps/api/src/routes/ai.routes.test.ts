import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it } from 'node:test';

// Entitlements fall back to the free tier (which includes `ai:basic`) without
// calling out when no billing endpoint is configured, so the only network
// request this route could make would be a model call.
delete process.env.DHANAM_API_URL;
delete process.env.DHANAM_API_TOKEN;

type TestApp = { request: (path: string, init?: RequestInit) => Response | Promise<Response> };
let app: TestApp;

const headers = {
  'Content-Type': 'application/json',
  'X-Voxa-User-Id': 'user-1',
  'X-Voxa-Role': 'communicator',
};

async function setAiConsent(granted: boolean): Promise<void> {
  const res = await app.request('/v1/consents', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ consents: { ai_processing: granted } }),
  });
  assert.equal(res.status, 200);
}

describe('AI prediction routes', () => {
  const realFetch = globalThis.fetch;
  let outbound: string[] = [];

  before(async () => {
    // Imported after the env cleanup above (a static import would be hoisted).
    // Depending on the module loader the default export may arrive wrapped.
    const mod = (await import('../app.js')) as unknown as { default: TestApp | { default: TestApp } };
    app = 'request' in mod.default ? mod.default : mod.default.default;
  });

  beforeEach(async () => {
    await setAiConsent(true);
    outbound = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      outbound.push(String(input instanceof Request ? input.url : input));
      throw new Error('outbound request blocked in test');
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('POST /v1/ai/predict/text answers from the local predictor with no outbound request', async () => {
    const res = await app.request('/v1/ai/predict/text', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        profileId: 'p1',
        recentUtterances: [],
        partialText: 'I',
        locale: 'en-US',
        maxSuggestions: 3,
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { predictions: Array<{ text: string }>; source: string };
    assert.equal(body.source, 'local');
    assert.ok(Array.isArray(body.predictions));
    assert.ok(body.predictions.length > 0);
    assert.deepEqual(outbound, []);
  });

  it('POST /v1/ai/predict/symbols answers from the local predictor with no outbound request', async () => {
    const res = await app.request('/v1/ai/predict/symbols', {
      method: 'POST',
      headers,
      body: JSON.stringify({ profileId: 'p1', recentSymbolIds: [], boardButtons: [], maxSuggestions: 3 }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { source: string };
    assert.equal(body.source, 'local');
    assert.deepEqual(outbound, []);
  });

  it('answers 403 without an ai_processing consent record, whatever the client header says', async () => {
    const body = JSON.stringify({ profileId: 'p1', recentUtterances: [], partialText: 'I', locale: 'en-US' });
    const stranger = { ...headers, 'X-Voxa-User-Id': 'user-without-consent', 'X-Voxa-AI-Consent': 'true' };
    for (const path of ['/v1/ai/predict/text', '/v1/ai/predict/symbols']) {
      const res = await app.request(path, { method: 'POST', headers: stranger, body });
      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), { error: 'AI consent required', purpose: 'ai_processing' });
    }
    assert.deepEqual(outbound, []);
  });

  it('answers 403 again once the user revokes ai_processing', async () => {
    await setAiConsent(false);
    const res = await app.request('/v1/ai/predict/text', {
      method: 'POST',
      headers,
      body: JSON.stringify({ profileId: 'p1', recentUtterances: [], partialText: 'I', locale: 'en-US' }),
    });
    assert.equal(res.status, 403);
    assert.deepEqual(outbound, []);
  });
});
