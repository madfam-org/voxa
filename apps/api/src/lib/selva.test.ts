import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_PARTIAL_CHARS,
  SelvaTokenCache,
  parseSelvaSuggestions,
  predictTextPreferSelva,
  readSelvaConfig,
  type SelvaConfig,
} from './selva.js';

const TOKEN_URL = 'https://janua.test/api/v1/oauth/token';
const BASE_URL = 'https://selva.test';

const ENABLED_ENV: NodeJS.ProcessEnv = {
  SELVA_ENABLED: 'true',
  SELVA_BASE_URL: `${BASE_URL}/`,
  SELVA_CLIENT_ID: 'test-client',
  SELVA_CLIENT_SECRET: 'test-secret',
  JANUA_TOKEN_URL: TOKEN_URL,
};

interface Call {
  url: string;
  init: RequestInit;
}

type Responder = (call: Call) => Response | Promise<Response>;

/** A fetch stand-in that records every call and answers per URL. */
function fakeFetch(handlers: { token?: Responder; completion?: Responder }) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    const call = { url, init };
    calls.push(call);
    const handler = url === TOKEN_URL ? handlers.token : handlers.completion;
    if (!handler) throw new Error(`unexpected request to ${url}`);
    return handler(call);
  }) as typeof fetch;
  return { fn, calls, tokenCalls: () => calls.filter((c) => c.url === TOKEN_URL), completionCalls: () => calls.filter((c) => c.url !== TOKEN_URL) };
}

const tokenOk = (expiresIn = 300, token = 'token-1'): Responder =>
  () => Response.json({ access_token: token, token_type: 'Bearer', expires_in: expiresIn });

const completionOk = (content: unknown): Responder =>
  () => Response.json({ choices: [{ index: 0, message: { role: 'assistant', content } }] });

function headerOf(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

const config = (): SelvaConfig => {
  const result = readSelvaConfig(ENABLED_ENV);
  assert.ok(result.enabled);
  return result.config;
};

describe('readSelvaConfig', () => {
  it('is off unless SELVA_ENABLED is exactly true', () => {
    assert.deepEqual(readSelvaConfig({}), { enabled: false, reason: 'disabled' });
    assert.deepEqual(readSelvaConfig({ ...ENABLED_ENV, SELVA_ENABLED: 'false' }), { enabled: false, reason: 'disabled' });
    assert.deepEqual(readSelvaConfig({ ...ENABLED_ENV, SELVA_ENABLED: '1' }), { enabled: false, reason: 'disabled' });
  });

  it('names the missing settings and never their values', () => {
    const result = readSelvaConfig({ SELVA_ENABLED: 'true', SELVA_CLIENT_SECRET: 'x' });
    assert.deepEqual(result, {
      enabled: false,
      reason: 'incomplete',
      missing: ['SELVA_BASE_URL', 'SELVA_CLIENT_ID', 'JANUA_TOKEN_URL'],
    });
  });

  it('defaults the scope and timeout and trims the base URL', () => {
    const c = config();
    assert.equal(c.baseUrl, BASE_URL);
    assert.equal(c.scope, 'selva:infer');
    assert.equal(c.timeoutMs, 2000);
  });
});

describe('SelvaTokenCache', () => {
  it('fetches a client_credentials token on a miss and reuses it on a hit', async () => {
    let now = 1_000_000;
    const cache = new SelvaTokenCache(() => now);
    const fake = fakeFetch({ token: tokenOk(300) });

    assert.equal(await cache.get(config(), fake.fn), 'token-1');
    now += 200_000; // 100 s before expiry: still outside the 60 s margin
    assert.equal(await cache.get(config(), fake.fn), 'token-1');
    assert.equal(fake.tokenCalls().length, 1);

    const body = new URLSearchParams(String(fake.tokenCalls()[0]?.init.body));
    assert.equal(body.get('grant_type'), 'client_credentials');
    assert.equal(body.get('client_id'), 'test-client');
    assert.equal(body.get('scope'), 'selva:infer');
    assert.equal(headerOf(fake.tokenCalls()[0]!.init, 'Content-Type'), 'application/x-www-form-urlencoded');
  });

  it('refreshes the token inside the 60 s margin before expiry', async () => {
    let now = 1_000_000;
    let issued = 0;
    const cache = new SelvaTokenCache(() => now);
    const fake = fakeFetch({ token: () => tokenOk(300, `token-${++issued}`)({ url: '', init: {} }) });

    assert.equal(await cache.get(config(), fake.fn), 'token-1');
    now += 241_000; // 59 s before expiry
    assert.equal(await cache.get(config(), fake.fn), 'token-2');
    assert.equal(fake.tokenCalls().length, 2);
  });

  it('shares one in-flight token request between concurrent callers', async () => {
    const cache = new SelvaTokenCache(() => 0);
    const fake = fakeFetch({ token: tokenOk(300) });
    const tokens = await Promise.all([cache.get(config(), fake.fn), cache.get(config(), fake.fn)]);
    assert.deepEqual(tokens, ['token-1', 'token-1']);
    assert.equal(fake.tokenCalls().length, 1);
  });

  it('falls back to the JWT exp claim when expires_in is absent', async () => {
    let now = 1_000_000;
    const cache = new SelvaTokenCache(() => now);
    const exp = Math.floor(now / 1000) + 600;
    const jwt = `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.y`;
    const fake = fakeFetch({ token: () => Response.json({ access_token: jwt }) });
    await cache.get(config(), fake.fn);
    now += 300_000;
    await cache.get(config(), fake.fn);
    assert.equal(fake.tokenCalls().length, 1);
  });
});

describe('parseSelvaSuggestions', () => {
  it('keeps short plain strings from a JSON array, deduplicated', () => {
    assert.deepEqual(parseSelvaSuggestions('["agua", "Agua", "más comida", 3, "por favor."]', 5), [
      'agua',
      'más comida',
      'por favor',
    ]);
  });

  it('accepts a fenced array or a bulleted list and drops long or markup items', () => {
    assert.deepEqual(parseSelvaSuggestions('```json\n["jugar"]\n```', 3), ['jugar']);
    assert.deepEqual(parseSelvaSuggestions('- comer\n2. una frase de muchas palabras aquí\n* <b>x</b>', 3), ['comer']);
  });
});

describe('predictTextPreferSelva', () => {
  const input = { partialText: 'yo quiero', locale: 'es-MX', maxSuggestions: 3 };

  it('makes no outbound request when SELVA_ENABLED is not true', async () => {
    const fake = fakeFetch({});
    const result = await predictTextPreferSelva(input, { env: {}, fetch: fake.fn, tokenCache: new SelvaTokenCache() });
    assert.equal(result.source, 'local');
    assert.ok(result.predictions.length > 0);
    assert.equal(fake.calls.length, 0);
  });

  it('makes no outbound request when the configuration is incomplete', async () => {
    const fake = fakeFetch({});
    const logs: string[] = [];
    const result = await predictTextPreferSelva(input, {
      env: { SELVA_ENABLED: 'true' },
      fetch: fake.fn,
      tokenCache: new SelvaTokenCache(),
      log: (m) => logs.push(m),
    });
    assert.equal(result.source, 'local');
    assert.equal(fake.calls.length, 0);
  });

  it('answers from Selva with X-Sensitivity: restricted and only the partial utterance', async () => {
    const fake = fakeFetch({ token: tokenOk(), completion: completionOk('["agua", "más", "jugar"]') });
    const result = await predictTextPreferSelva(
      { partialText: '  yo   quiero ', locale: 'es-MX', maxSuggestions: 3 },
      { env: ENABLED_ENV, fetch: fake.fn, tokenCache: new SelvaTokenCache() },
    );

    assert.equal(result.source, 'selva');
    assert.deepEqual(
      result.predictions.map((p) => p.text),
      ['yo quiero agua', 'yo quiero más', 'yo quiero jugar'],
    );

    const [call] = fake.completionCalls();
    assert.ok(call);
    assert.equal(call.url, `${BASE_URL}/v1/chat/completions`);
    assert.equal(headerOf(call.init, 'X-Sensitivity'), 'restricted');
    assert.equal(headerOf(call.init, 'Authorization'), 'Bearer token-1');

    const body = JSON.parse(String(call.init.body)) as {
      messages: Array<{ role: string; content: string }>;
      stream: boolean;
    };
    assert.equal(body.stream, false);
    assert.deepEqual(
      body.messages.map((m) => m.role),
      ['system', 'user'],
    );
    assert.equal(body.messages[1]?.content, 'yo quiero');
    assert.match(body.messages[0]?.content ?? '', /Spanish \(es-MX\)/);
    assert.doesNotMatch(String(call.init.body), /profileId|userId|user-1|recentUtterances/);
  });

  it('sends at most the last 200 characters of a long utterance', async () => {
    const fake = fakeFetch({ token: tokenOk(), completion: completionOk('["fin"]') });
    const long = `${'palabra '.repeat(60)}final`;
    await predictTextPreferSelva(
      { partialText: long, locale: 'es-MX', maxSuggestions: 1 },
      { env: ENABLED_ENV, fetch: fake.fn, tokenCache: new SelvaTokenCache() },
    );
    const body = JSON.parse(String(fake.completionCalls()[0]?.init.body)) as { messages: Array<{ content: string }> };
    const sent = body.messages[1]?.content ?? '';
    assert.equal(sent.length, MAX_PARTIAL_CHARS);
    assert.ok(sent.endsWith('final'));
  });

  it('carries X-Sensitivity: restricted on every request, including after a token refresh', async () => {
    let now = 0;
    const cache = new SelvaTokenCache(() => now);
    const fake = fakeFetch({ token: tokenOk(120), completion: completionOk('["agua"]') });
    for (let i = 0; i < 3; i++) {
      await predictTextPreferSelva(input, { env: ENABLED_ENV, fetch: fake.fn, tokenCache: cache });
      now += 90_000;
    }
    assert.equal(fake.completionCalls().length, 3);
    assert.ok(fake.completionCalls().every((c) => headerOf(c.init, 'X-Sensitivity') === 'restricted'));
    assert.ok(fake.tokenCalls().length >= 2);
  });

  for (const [name, handlers, code] of [
    ['a 503 for no local model', { token: tokenOk(), completion: () => new Response('{}', { status: 503 }) }, 'http_503'],
    ['a token endpoint error', { token: () => new Response('{}', { status: 401 }) }, 'token_http_401'],
    ['a network failure', { token: tokenOk(), completion: () => Promise.reject(new TypeError('fetch failed')) }, 'network'],
    ['a malformed answer', { token: tokenOk(), completion: completionOk({ not: 'a string' }) }, 'invalid_response'],
    ['an empty answer', { token: tokenOk(), completion: completionOk('[]') }, 'empty_response'],
  ] as const) {
    it(`degrades to the local predictor on ${name} and logs only a reason code`, async () => {
      const fake = fakeFetch(handlers);
      const logs: string[] = [];
      const result = await predictTextPreferSelva(input, {
        env: ENABLED_ENV,
        fetch: fake.fn,
        tokenCache: new SelvaTokenCache(),
        log: (m) => logs.push(m),
      });
      assert.equal(result.source, 'local');
      assert.deepEqual(
        result.predictions.map((p) => p.text),
        ['yo quiero más', 'yo quiero comer', 'yo quiero agua'],
      );
      assert.deepEqual(logs, [`Selva predictions unavailable (${code}); using the local predictor`]);
      assert.doesNotMatch(logs.join('\n'), /yo quiero|token-1|test-secret/);
    });
  }

  it('degrades to the local predictor when Selva does not answer in time', async () => {
    const hanging: Responder = ({ init }) =>
      new Promise<Response>((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    const fake = fakeFetch({ token: tokenOk(), completion: hanging });
    const logs: string[] = [];
    const started = Date.now();
    const result = await predictTextPreferSelva(input, {
      env: { ...ENABLED_ENV, SELVA_TIMEOUT_MS: '200' },
      fetch: fake.fn,
      tokenCache: new SelvaTokenCache(),
      log: (m) => logs.push(m),
    });
    assert.equal(result.source, 'local');
    assert.ok(Date.now() - started < 2000);
    assert.deepEqual(logs, ['Selva predictions unavailable (timeout); using the local predictor']);
  });

  it('drops a token Selva rejects, so the next request fetches a new one', async () => {
    const cache = new SelvaTokenCache(() => 0);
    let status = 401;
    const fake = fakeFetch({
      token: tokenOk(),
      completion: () => (status === 401 ? new Response('{}', { status: 401 }) : completionOk('["agua"]')({ url: '', init: {} })),
    });
    const first = await predictTextPreferSelva(input, { env: ENABLED_ENV, fetch: fake.fn, tokenCache: cache, log: () => {} });
    assert.equal(first.source, 'local');
    status = 200;
    const second = await predictTextPreferSelva(input, { env: ENABLED_ENV, fetch: fake.fn, tokenCache: cache, log: () => {} });
    assert.equal(second.source, 'selva');
    assert.equal(fake.tokenCalls().length, 2);
  });

  it('makes no outbound request for an empty utterance', async () => {
    const fake = fakeFetch({});
    const result = await predictTextPreferSelva(
      { partialText: '   ', locale: 'es-MX', maxSuggestions: 3 },
      { env: ENABLED_ENV, fetch: fake.fn, tokenCache: new SelvaTokenCache() },
    );
    assert.deepEqual(result, { predictions: [], source: 'local' });
    assert.equal(fake.calls.length, 0);
  });
});
