import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Hono } from 'hono';
import { resolveWsTeam } from './ws-auth.js';

describe('resolveWsTeam', () => {
  afterEach(() => {
    delete process.env.VOXA_JANUA_AUTH_REQUIRED;
    delete process.env.JANUA_AUTH_REQUIRED;
  });

  it('returns dev team when auth is not required and no token is present', async () => {
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
});
