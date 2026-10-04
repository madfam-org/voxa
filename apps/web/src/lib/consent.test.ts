import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  CONSENT_CACHE_KEY,
  decisionFromServer,
  getAiConsent,
  getUsageConsent,
  getUtteranceTextConsent,
  LEGACY_CONSENT_KEY,
  parseConsentCache,
  recordConsentChoices,
  writeConsentCache,
} from './consent';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.has(key) ? this.values.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const globals = globalThis as unknown as { window?: unknown; fetch: typeof fetch };
const realFetch = globals.fetch;
let storage: MemoryStorage;
let events: string[];
let requests: Array<{ url: string; init?: RequestInit }>;

beforeEach(() => {
  storage = new MemoryStorage();
  events = [];
  requests = [];
  globals.window = {
    localStorage: storage,
    dispatchEvent: (event: Event) => {
      events.push(event.type);
      return true;
    },
  };
});

afterEach(() => {
  delete globals.window;
  globals.fetch = realFetch;
});

describe('consent cache', () => {
  it('treats a missing, malformed or legacy value as undecided', () => {
    assert.equal(parseConsentCache(null), null);
    assert.equal(parseConsentCache('granted'), null);
    assert.equal(parseConsentCache('{"choices":{"aiProcessing":true}}'), null);
    storage.setItem(LEGACY_CONSENT_KEY, 'granted');
    assert.equal(getAiConsent(), false, 'the old single flag is not consent for either purpose');
    assert.equal(getUsageConsent(), false);
  });

  it('reads each purpose separately', () => {
    writeConsentCache({
      choices: { aiProcessing: true, usageAnalytics: false },
      utteranceText: false,
      source: 'local',
      decidedAt: '2026-10-03T00:00:00.000Z',
    });
    assert.equal(getAiConsent(), true);
    assert.equal(getUsageConsent(), false);
    assert.equal(getUtteranceTextConsent(), false);
    assert.deepEqual(events, ['voxa-consent-change']);
    assert.ok(storage.getItem(CONSENT_CACHE_KEY));
  });
});

describe('server decision', () => {
  it('is undecided until both purposes have a record', () => {
    const partial = decisionFromServer({
      policyVersion: 'v',
      consents: [{ purpose: 'ai_processing', granted: true }],
      utteranceTextAvailable: false,
    });
    assert.equal(partial.decided, false);

    const full = decisionFromServer({
      policyVersion: 'v',
      consents: [
        { purpose: 'ai_processing', granted: false },
        { purpose: 'usage_analytics', granted: true },
      ],
      utteranceTextAvailable: false,
    });
    assert.deepEqual(full, {
      decided: true,
      choices: { aiProcessing: false, usageAnalytics: true },
      utteranceText: false,
    });
  });

  it('honours utterance text only when the server says it is available', () => {
    const consents = [
      { purpose: 'ai_processing', granted: false },
      { purpose: 'usage_analytics', granted: true },
      { purpose: 'utterance_text', granted: true },
    ];
    assert.equal(
      decisionFromServer({ policyVersion: 'v', consents, utteranceTextAvailable: false })
        .utteranceText,
      false,
    );
    assert.equal(
      decisionFromServer({ policyVersion: 'v', consents, utteranceTextAvailable: true })
        .utteranceText,
      true,
    );
  });
});

describe('recordConsentChoices', () => {
  it('signed out: keeps the choice on this device and sends nothing', async () => {
    globals.fetch = (async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      throw new Error('no request expected');
    }) as unknown as typeof fetch;
    const cache = await recordConsentChoices(false, {
      aiProcessing: true,
      usageAnalytics: false,
    });
    assert.equal(cache.source, 'local');
    assert.deepEqual(requests, []);
    assert.equal(getAiConsent(), true);
  });

  it('signed in: saves to the API and caches the API’s answer', async () => {
    globals.fetch = (async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return new Response(
        JSON.stringify({
          policyVersion: 'v',
          consents: [
            { purpose: 'ai_processing', granted: true },
            { purpose: 'usage_analytics', granted: true },
          ],
          utteranceTextAvailable: false,
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const cache = await recordConsentChoices(true, { aiProcessing: true, usageAnalytics: true });
    assert.equal(cache.source, 'server');
    assert.equal(requests.length, 1);
    // Through the same-origin proxy: the session cookie, never a bearer in page code.
    assert.equal(requests[0]!.url, '/api/v1/consents');
    assert.equal(requests[0]!.init?.credentials, 'same-origin');
    assert.equal(requests[0]!.init?.method, 'PUT');
    assert.deepEqual(JSON.parse(String(requests[0]!.init?.body)), {
      consents: { ai_processing: true, usage_analytics: true },
    });
    assert.equal(
      (requests[0]!.init?.headers as Record<string, string>).Authorization,
      undefined,
    );
    assert.equal(getUsageConsent(), true);
  });

  it('signed in: a failed save throws and leaves the cache untouched', async () => {
    globals.fetch = (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch;
    await assert.rejects(
      recordConsentChoices(true, { aiProcessing: true, usageAnalytics: true }),
    );
    assert.equal(storage.getItem(CONSENT_CACHE_KEY), null);
    assert.equal(getAiConsent(), false);
  });
});
