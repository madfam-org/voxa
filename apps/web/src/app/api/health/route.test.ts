import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GET } from './route.js';

describe('GET /api/health', () => {
  const savedSha = process.env.GIT_SHA;

  afterEach(() => {
    if (savedSha === undefined) delete process.env.GIT_SHA;
    else process.env.GIT_SHA = savedSha;
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
});
