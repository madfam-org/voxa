import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GET } from './route.js';

describe('GET /api/health', () => {
  const savedSha = process.env.GIT_SHA;
  const savedSecret = process.env.AUTH_SECRET;

  afterEach(() => {
    if (savedSha === undefined) delete process.env.GIT_SHA;
    else process.env.GIT_SHA = savedSha;
    if (savedSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = savedSecret;
  });

  it('returns service metadata for probes', async () => {
    const res = await GET();
    assert.equal(res.status, 200);

    const body = (await res.json()) as { status: string; service: string; version: string };
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'voxa-web');
    assert.match(body.version, /^\d+\.\d+\.\d+$/);
  });

  it('serves the build identity from GIT_SHA', async () => {
    const sha = '0123456789abcdef0123456789abcdef01234567';
    process.env.GIT_SHA = sha;
    const body = (await (await GET()).json()) as Record<string, unknown>;
    assert.equal(body.build, sha);
    assert.ok(!JSON.stringify(body).includes('GIT_SHA'));
  });

  it('answers build "unknown" without a build identity', async () => {
    delete process.env.GIT_SHA;
    const body = (await (await GET()).json()) as { build: string };
    assert.equal(body.build, 'unknown');
  });

  it('reports which sign-in settings are present as booleans, never values', async () => {
    process.env.AUTH_SECRET = 'test-only-secret-value-xyz';
    const res = await GET();
    const text = await res.text();
    assert.ok(!text.includes('test-only-secret-value-xyz'));
    const body = JSON.parse(text) as { auth: Record<string, boolean>; oidcClientSecretSet?: unknown };
    assert.deepEqual(Object.keys(body.auth).sort(), [
      'AUTH_JANUA_CLIENT_ID',
      'AUTH_JANUA_CLIENT_SECRET',
      'AUTH_JANUA_ISSUER',
      'AUTH_SECRET',
    ]);
    assert.equal(body.auth.AUTH_SECRET, true);
    assert.equal(body.oidcClientSecretSet, undefined);
  });
});
