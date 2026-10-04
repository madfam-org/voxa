import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it } from 'node:test';

// Entitlements come from the access token's `voxa_tier` claim (none here, so
// the free tier, which includes `ai:basic`) and never from a network call, so
// the only network request this route could make would be a model call.

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
    // Imported lazily, inside the suite.
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

  it('makes no outbound request for a Spanish board with Selva off and answers in Spanish', async () => {
    delete process.env.SELVA_ENABLED;
    const res = await app.request('/v1/ai/predict/text', {
      method: 'POST',
      headers,
      body: JSON.stringify({ profileId: 'p1', recentUtterances: [], partialText: 'yo', locale: 'es-MX', maxSuggestions: 3 }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { predictions: Array<{ text: string }>; source: string };
    assert.equal(body.source, 'local');
    assert.deepEqual(
      body.predictions.map((p) => p.text),
      ['yo quiero', 'yo necesito', 'yo voy'],
    );
    assert.deepEqual(outbound, []);
  });

  describe('with Selva enabled', () => {
    const selvaEnv = {
      SELVA_ENABLED: 'true',
      SELVA_BASE_URL: 'https://selva.test',
      SELVA_CLIENT_ID: 'test-client',
      SELVA_CLIENT_SECRET: 'test-secret',
      JANUA_TOKEN_URL: 'https://janua.test/api/v1/oauth/token',
    };
    let completionStatus = 200;
    let sensitivity: Array<string | null> = [];

    beforeEach(async () => {
      Object.assign(process.env, selvaEnv);
      const { defaultSelvaTokenCache } = await import('../lib/selva.js');
      defaultSelvaTokenCache.clear();
      completionStatus = 200;
      sensitivity = [];
      globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = String(input instanceof Request ? input.url : input);
        outbound.push(url);
        if (url === selvaEnv.JANUA_TOKEN_URL) {
          return Response.json({ access_token: 'token-1', expires_in: 300 });
        }
        sensitivity.push(new Headers(init.headers).get('X-Sensitivity'));
        if (completionStatus !== 200) return new Response('{}', { status: completionStatus });
        return Response.json({ choices: [{ message: { role: 'assistant', content: '["agua", "jugar"]' } }] });
      }) as typeof fetch;
    });

    afterEach(() => {
      for (const key of Object.keys(selvaEnv)) delete process.env[key];
    });

    const predict = (user = 'user-1') =>
      app.request('/v1/ai/predict/text', {
        method: 'POST',
        headers: { ...headers, 'X-Voxa-User-Id': user },
        body: JSON.stringify({ profileId: 'p1', recentUtterances: [], partialText: 'yo quiero', locale: 'es-MX' }),
      });

    it('answers from Selva with source selva and X-Sensitivity: restricted', async () => {
      const res = await predict();
      assert.equal(res.status, 200);
      const body = (await res.json()) as { predictions: Array<{ text: string }>; source: string };
      assert.equal(body.source, 'selva');
      assert.deepEqual(
        body.predictions.map((p) => p.text),
        ['yo quiero agua', 'yo quiero jugar'],
      );
      assert.deepEqual(sensitivity, ['restricted']);
    });

    it('answers 200 from the local predictor when Selva has no local model (503)', async () => {
      completionStatus = 503;
      const res = await predict();
      assert.equal(res.status, 200);
      const body = (await res.json()) as { predictions: Array<{ text: string }>; source: string };
      assert.equal(body.source, 'local');
      assert.equal(body.predictions[0]?.text, 'yo quiero más');
      assert.deepEqual(sensitivity, ['restricted']);
    });

    it('still answers 403 without ai_processing consent and calls nothing', async () => {
      const res = await predict('user-without-consent');
      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), { error: 'AI consent required', purpose: 'ai_processing' });
      assert.deepEqual(outbound, []);
    });

    it('keeps symbol predictions local', async () => {
      const res = await app.request('/v1/ai/predict/symbols', {
        method: 'POST',
        headers,
        body: JSON.stringify({ profileId: 'p1', recentSymbolIds: [], boardButtons: [], maxSuggestions: 3 }),
      });
      assert.equal(res.status, 200);
      assert.equal(((await res.json()) as { source: string }).source, 'local');
      assert.deepEqual(outbound, []);
    });
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
