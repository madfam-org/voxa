import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GET } from './route.js';

const KEYS = [
  'OIDC_ISSUER',
  'NEXT_PUBLIC_OIDC_ISSUER',
  'OIDC_CLIENT_ID',
  'NEXT_PUBLIC_OIDC_CLIENT_ID',
] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

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

  it('is ready when the OIDC issuer and client id are configured', async () => {
    setEnv({ OIDC_ISSUER: 'https://issuer.example', OIDC_CLIENT_ID: 'client-id' });
    const res = await GET();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = (await res.json()) as { status: string; service: string };
    assert.deepEqual(body, { status: 'ready', service: 'voxa-web' });
  });

  it('returns 503 without leaking values when the OIDC client id is missing', async () => {
    setEnv({ OIDC_ISSUER: 'https://issuer.example' });
    const res = await GET();
    assert.equal(res.status, 503);
    const text = await res.text();
    assert.ok(!text.includes('issuer.example'));
    assert.deepEqual(JSON.parse(text), {
      status: 'unavailable',
      service: 'voxa-web',
      missing: ['oidc'],
    });
  });
});
