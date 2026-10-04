import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GET } from './route.js';

const KEYS = ['AUTH_SECRET', 'AUTH_JANUA_ISSUER', 'AUTH_JANUA_CLIENT_ID', 'AUTH_JANUA_CLIENT_SECRET'] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const COMPLETE = {
  AUTH_SECRET: 'test-only-session-secret-value-0001',
  AUTH_JANUA_ISSUER: 'https://issuer.example',
  AUTH_JANUA_CLIENT_ID: 'client-id-value',
  AUTH_JANUA_CLIENT_SECRET: 'client-secret-value',
};

function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
}

describe('GET /api/health/ready', () => {
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('is ready when the session secret and the Janua client are configured', async () => {
    setEnv(COMPLETE);
    const res = await GET();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), { status: 'ready', service: 'voxa-web' });
  });

  for (const key of KEYS) {
    it(`is not ready without ${key}, and names it without leaking any value`, async () => {
      const { [key]: _omitted, ...rest } = COMPLETE;
      setEnv(rest);
      const res = await GET();
      assert.equal(res.status, 503);
      const text = await res.text();
      for (const value of Object.values(COMPLETE)) assert.ok(!text.includes(value));
      assert.deepEqual(JSON.parse(text), { status: 'unavailable', service: 'voxa-web', missing: [key] });
    });
  }

  it('treats a blank value as missing', async () => {
    setEnv({ ...COMPLETE, AUTH_SECRET: '   ' });
    const res = await GET();
    assert.equal(res.status, 503);
    assert.deepEqual((await res.json()).missing, ['AUTH_SECRET']);
  });
});
