import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { DEMO_BOARD_ID } from '@voxa/core';
import { CONSENT_CACHE_KEY, type ConsentCache } from './consent';
import { logButtonActivation } from './log-activation';

const globals = globalThis as unknown as { window?: unknown; fetch: typeof fetch };
const realFetch = globals.fetch;
let stored: Record<string, string>;
let bodies: unknown[];

function decide(cache: Partial<ConsentCache> & { choices: ConsentCache['choices'] }) {
  stored[CONSENT_CACHE_KEY] = JSON.stringify({
    utteranceText: false,
    source: 'server',
    decidedAt: '2026-10-03T00:00:00.000Z',
    ...cache,
  });
}

const press = { boardId: 'family-board', buttonId: 'want', speechText: 'I want juice' };

beforeEach(() => {
  stored = {};
  bodies = [];
  globals.window = {
    localStorage: {
      getItem: (key: string) => stored[key] ?? null,
      setItem: (key: string, value: string) => {
        stored[key] = value;
      },
      removeItem: (key: string) => {
        delete stored[key];
      },
    },
    dispatchEvent: () => true,
  };
  globals.fetch = (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers['X-Voxa-AI-Consent'], undefined, 'no client consent header');
    return new Response('{}', { status: 201 });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  delete globals.window;
  globals.fetch = realFetch;
});

describe('logButtonActivation', () => {
  it('sends nothing while undecided, signed out, or with usage counts off', async () => {
    await logButtonActivation(true, press);
    decide({ choices: { aiProcessing: true, usageAnalytics: false } });
    await logButtonActivation(true, press);
    decide({ choices: { aiProcessing: false, usageAnalytics: true } });
    await logButtonActivation(false, press);
    assert.deepEqual(bodies, []);
  });

  it('never logs the shared demo board', async () => {
    decide({ choices: { aiProcessing: false, usageAnalytics: true } });
    await logButtonActivation(true, { ...press, boardId: DEMO_BOARD_ID });
    assert.deepEqual(bodies, []);
  });

  it('sends ids only, without the spoken text, under usage counts', async () => {
    decide({ choices: { aiProcessing: false, usageAnalytics: true } });
    await logButtonActivation(true, press);
    assert.deepEqual(bodies, [{ boardId: 'family-board', buttonId: 'want' }]);
  });

  it('includes the text only when the API reported text retention for this user', async () => {
    decide({ choices: { aiProcessing: false, usageAnalytics: true }, utteranceText: true });
    await logButtonActivation(true, press);
    assert.deepEqual(bodies, [press]);
  });
});
