import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import app from './app.js';

describe('GET /health', () => {
  it('returns service metadata for probes', async () => {
    const res = await app.request('/health');

    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; service: string; version: string };
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'voxa-api');
    assert.match(body.version, /^\d+\.\d+\.\d+$/);
  });
});
