import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Hono } from 'hono';
import { resolveWsTeam } from './ws-auth.js';

describe('resolveWsTeam', () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, VOXA_DEV_AUTH: process.env.VOXA_DEV_AUTH };

  afterEach(() => {
    delete process.env.VOXA_JANUA_AUTH_REQUIRED;
    delete process.env.JANUA_AUTH_REQUIRED;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('returns dev team with VOXA_DEV_AUTH=true outside production and no token', async () => {
    const app = new Hono();
    app.get('/ws', async (c) => c.json(await resolveWsTeam(c)));

    const res = await app.request('/ws?boardId=demo-core&userId=dev-a&role=editor');
    const team = (await res.json()) as { userId: string; role: string };
    assert.equal(team.userId, 'dev-a');
    assert.equal(team.role, 'editor');
  });

  it('returns null when auth is required and no token is present', async () => {
    process.env.VOXA_JANUA_AUTH_REQUIRED = 'true';
    const app = new Hono();
    app.get('/ws', async (c) => c.json(await resolveWsTeam(c)));

    const res = await app.request('/ws?boardId=demo-core');
    assert.equal(await res.json(), null);
  });

  it('ignores ?userId=&role= in production even with VOXA_DEV_AUTH=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VOXA_DEV_AUTH = 'true';
    const app = new Hono();
    app.get('/ws', async (c) => c.json(await resolveWsTeam(c)));

    const res = await app.request('/ws?boardId=demo-core&userId=dev-a&role=admin');
    assert.equal(await res.json(), null);
  });

  it('ignores ?userId=&role= without VOXA_DEV_AUTH', async () => {
    delete process.env.VOXA_DEV_AUTH;
    const app = new Hono();
    app.get('/ws', async (c) => c.json(await resolveWsTeam(c)));

    const res = await app.request('/ws?boardId=demo-core&userId=dev-a&role=admin');
    assert.equal(await res.json(), null);
  });
});
