import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import app from '../app.js';
import { closeSharedDb, getSharedDb } from '../db/client.js';
import { putUserSettings } from '../lib/user-settings.js';
import { initStore } from '../store/index.js';
import { devHeaders } from '../test-support/boards.js';
import { putConsents } from '../test-support/consents.js';

/**
 * Settings sync against a real PostgreSQL: compare-and-set writes (two
 * writers on one version, exactly one wins), and revoking `settings_sync`
 * deletes the row. Runs when VOXA_TEST_DATABASE_URL is set (a throwaway
 * database: it migrates and writes there) and skips itself otherwise.
 */
const testDatabaseUrl = process.env.VOXA_TEST_DATABASE_URL?.trim();
const skip = testDatabaseUrl ? false : 'VOXA_TEST_DATABASE_URL is not set';

const RUN = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
const AT = '2026-10-04T12:00:00.000Z';

describe('settings sync on PostgreSQL', { skip }, () => {
  before(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    assert.equal(await initStore(), 'postgres');
  });

  after(async () => {
    await closeSharedDb();
  });

  async function rowCount(userId: string): Promise<number> {
    const { client } = getSharedDb(testDatabaseUrl!);
    const rows = await client<Array<{ n: number }>>`select count(*)::int as n from user_settings where user_id = ${userId}`;
    return rows[0]!.n;
  }

  function put(userId: string, body: unknown) {
    return app.request('/v1/me/settings', {
      method: 'PUT',
      headers: { ...devHeaders(userId), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('stores, versions and returns the document; a stale write gets 409 with the current one', async () => {
    const userId = `settings-owner-${RUN}`;
    await putConsents(app, devHeaders(userId), { settings_sync: true });

    const first = await put(userId, { version: 0, fields: { switchIntervalMs: { value: 1500, updatedAt: AT } } });
    assert.equal(first.status, 200, await first.clone().text());
    const second = await put(userId, { version: 1, fields: { switchIntervalMs: { value: 2500, updatedAt: AT } } });
    assert.equal(second.status, 200);

    const stale = await put(userId, { version: 1, fields: {} });
    assert.equal(stale.status, 409);
    const body = (await stale.json()) as { current: { version: number; fields: Record<string, unknown> } };
    assert.equal(body.current.version, 2);
    assert.deepEqual(body.current.fields, { switchIntervalMs: { value: 2500, updatedAt: AT } });

    const read = await app.request('/v1/me/settings', { headers: devHeaders(userId) });
    assert.equal(read.status, 200);
    assert.equal(((await read.json()) as { version: number }).version, 2);
  });

  it('of two writers on one version exactly one wins', async () => {
    const userId = `settings-race-${RUN}`;
    const results = await Promise.all(
      [1000, 2000, 3000, 4000].map((value) =>
        putUserSettings(testDatabaseUrl, userId, 0, { switchIntervalMs: { value, updatedAt: AT } }),
      ),
    );
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.filter((r) => !r.ok).length, 3);
    const next = await Promise.all(
      [1000, 2000].map((value) =>
        putUserSettings(testDatabaseUrl, userId, 1, { switchIntervalMs: { value, updatedAt: AT } }),
      ),
    );
    assert.equal(next.filter((r) => r.ok).length, 1);
    assert.equal(await rowCount(userId), 1);
  });

  it('revoking settings_sync deletes the row; both methods then answer 403', async () => {
    const userId = `settings-revoke-${RUN}`;
    const bystander = `settings-bystander-${RUN}`;
    await putConsents(app, devHeaders(userId), { settings_sync: true });
    await putConsents(app, devHeaders(bystander), { settings_sync: true });
    assert.equal((await put(userId, { version: 0, fields: { hideLabels: { value: true, updatedAt: AT } } })).status, 200);
    assert.equal((await put(bystander, { version: 0, fields: { hideLabels: { value: true, updatedAt: AT } } })).status, 200);
    assert.equal(await rowCount(userId), 1);

    await putConsents(app, devHeaders(userId), { settings_sync: false });
    assert.equal(await rowCount(userId), 0);
    assert.equal(await rowCount(bystander), 1);
    assert.equal((await app.request('/v1/me/settings', { headers: devHeaders(userId) })).status, 403);
    assert.equal((await put(userId, { version: 0, fields: {} })).status, 403);
    assert.equal(await rowCount(userId), 0);
  });
});
