import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { beforeEach, describe, it } from 'node:test';
import app from '../app.js';
import { consentStorePath } from '../lib/consents.js';
import { userSettingsStorePath } from '../lib/user-settings.js';
import { devHeaders } from '../test-support/boards.js';
import { putConsents } from '../test-support/consents.js';
import { parseIfMatch } from './me-settings.js';

/**
 * `GET/PUT /v1/me/settings` on the file store (the PostgreSQL store runs the
 * same contract in me-settings.pg.test.ts).
 */
interface SettingsDocument {
  version: number;
  updatedAt: string | null;
  fields: Record<string, { value: unknown; updatedAt: string }>;
}

const AT = '2026-10-04T12:00:00.000Z';

function getSettings(headers: Record<string, string>) {
  return app.request('/v1/me/settings', { headers });
}

function putSettings(headers: Record<string, string>, body: unknown, extraHeaders: Record<string, string> = {}) {
  return app.request('/v1/me/settings', {
    method: 'PUT',
    headers: { ...headers, ...extraHeaders, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function enableSync(userId: string) {
  await putConsents(app, devHeaders(userId), { settings_sync: true });
}

function storedUserIds(): string[] {
  const path = userSettingsStorePath();
  return existsSync(path) ? Object.keys(JSON.parse(readFileSync(path, 'utf8')) as object) : [];
}

describe('settings sync routes (file store)', () => {
  beforeEach(() => {
    rmSync(consentStorePath(), { force: true });
    rmSync(userSettingsStorePath(), { force: true });
  });

  it('owner: GET starts empty at version 0, PUT 200 stores the document, GET returns it', async () => {
    await enableSync('user-1');
    const empty = await getSettings(devHeaders('user-1'));
    assert.equal(empty.status, 200);
    assert.equal(empty.headers.get('ETag'), '"0"');
    assert.deepEqual(await empty.json(), { version: 0, updatedAt: null, fields: {} });

    const put = await putSettings(devHeaders('user-1'), {
      version: 0,
      fields: { switchIntervalMs: { value: 1800, updatedAt: AT }, accessMode: { value: 'switch', updatedAt: AT } },
    });
    assert.equal(put.status, 200, await put.clone().text());
    const saved = (await put.json()) as SettingsDocument;
    assert.equal(saved.version, 1);
    assert.equal(put.headers.get('ETag'), '"1"');
    assert.deepEqual(saved.fields.switchIntervalMs, { value: 1800, updatedAt: AT });

    const read = (await (await getSettings(devHeaders('user-1'))).json()) as SettingsDocument;
    assert.deepEqual(read, saved);

    // If-Match works as well as the body version.
    const second = await putSettings(
      devHeaders('user-1'),
      { fields: { switchIntervalMs: { value: 2000, updatedAt: AT } } },
      { 'If-Match': '"1"' },
    );
    assert.equal(second.status, 200);
    assert.equal(((await second.json()) as SettingsDocument).version, 2);
  });

  it('another user: never reads or writes the owner’s settings (no route names a user: 404)', async () => {
    await enableSync('user-1');
    await enableSync('user-2');
    await putSettings(devHeaders('user-1'), { version: 0, fields: { hideLabels: { value: true, updatedAt: AT } } });

    // An admin is no exception, and a userId in the body or query is ignored.
    const other = (await (await app.request('/v1/me/settings?userId=user-1', { headers: devHeaders('user-2', 'admin') })).json()) as SettingsDocument;
    assert.deepEqual(other, { version: 0, updatedAt: null, fields: {} });
    for (const path of ['/v1/me/settings/user-1', '/v1/users/user-1/settings', '/v1/settings/user-1']) {
      const res = await app.request(path, { headers: devHeaders('user-2', 'admin') });
      assert.equal(res.status, 404, path);
      const write = await app.request(path, {
        method: 'PUT',
        headers: { ...devHeaders('user-2', 'admin'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 1, fields: {} }),
      });
      assert.equal(write.status, 404, path);
    }
    const bodyUser = await putSettings(devHeaders('user-2'), { version: 0, userId: 'user-1', fields: {} });
    assert.equal(bodyUser.status, 400);
    const mine = (await (await getSettings(devHeaders('user-1'))).json()) as SettingsDocument;
    assert.equal(mine.version, 1);
    assert.deepEqual(mine.fields.hideLabels, { value: true, updatedAt: AT });
  });

  it('unknown field 400, invalid value 400, missing version 428', async () => {
    await enableSync('user-1');
    const unknown = await putSettings(devHeaders('user-1'), {
      version: 0,
      fields: { voiceURIByLocale: { value: { 'es-MX': 'x' }, updatedAt: AT } },
    });
    assert.equal(unknown.status, 400);
    assert.deepEqual(await unknown.json(), { error: 'Invalid settings', code: 'UNKNOWN_FIELD', field: 'voiceURIByLocale' });

    const bad = await putSettings(devHeaders('user-1'), {
      version: 0,
      fields: { switchIntervalMs: { value: 5, updatedAt: AT } },
    });
    assert.equal(bad.status, 400);
    assert.equal(((await bad.json()) as { code: string }).code, 'INVALID_VALUE');

    assert.equal((await putSettings(devHeaders('user-1'), '{not json')).status, 400);
    assert.equal((await putSettings(devHeaders('user-1'), { version: 0, fields: [] })).status, 400);
    assert.equal((await putSettings(devHeaders('user-1'), { version: -1, fields: {} })).status, 400);
    assert.equal((await putSettings(devHeaders('user-1'), { fields: {} })).status, 428);
    assert.deepEqual(storedUserIds(), []);
  });

  it('oversize body 413', async () => {
    await enableSync('user-1');
    const res = await putSettings(devHeaders('user-1'), {
      version: 0,
      fields: { hideLabels: { value: true, updatedAt: AT } },
      padding: 'x'.repeat(20 * 1024),
    });
    assert.equal(res.status, 413);
    assert.equal(((await res.json()) as { code: string }).code, 'PAYLOAD_TOO_LARGE');
    assert.deepEqual(storedUserIds(), []);
  });

  it('stale version 409 with the current document', async () => {
    await enableSync('user-1');
    await putSettings(devHeaders('user-1'), { version: 0, fields: { hideLabels: { value: true, updatedAt: AT } } });
    await putSettings(devHeaders('user-1'), { version: 1, fields: { hideLabels: { value: false, updatedAt: AT } } });

    const stale = await putSettings(devHeaders('user-1'), {
      version: 1,
      fields: { hideSymbols: { value: true, updatedAt: AT } },
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.headers.get('ETag'), '"2"');
    const body = (await stale.json()) as { code: string; current: SettingsDocument };
    assert.equal(body.code, 'VERSION_CONFLICT');
    assert.equal(body.current.version, 2);
    assert.deepEqual(body.current.fields, { hideLabels: { value: false, updatedAt: AT } });

    // A first write when a document already exists is stale too.
    assert.equal((await putSettings(devHeaders('user-1'), { version: 0, fields: {} })).status, 409);
  });

  it('stores a device time in the future as the server time', async () => {
    await enableSync('user-1');
    const res = await putSettings(devHeaders('user-1'), {
      version: 0,
      fields: { hideLabels: { value: true, updatedAt: '2099-01-01T00:00:00.000Z' } },
    });
    const doc = (await res.json()) as SettingsDocument;
    assert.equal(doc.fields.hideLabels?.updatedAt, doc.updatedAt);
  });

  it('consent off: GET and PUT 403, and turning consent off deletes the stored copy', async () => {
    // Never granted.
    const never = await getSettings(devHeaders('user-1'));
    assert.equal(never.status, 403);
    assert.equal(((await never.json()) as { code: string }).code, 'CONSENT_REQUIRED');
    assert.equal(
      (await putSettings(devHeaders('user-1'), { version: 0, fields: { hideLabels: { value: true, updatedAt: AT } } })).status,
      403,
    );
    assert.deepEqual(storedUserIds(), []);

    // Granted, stored, then revoked: the copy is gone and both methods answer 403.
    await enableSync('user-1');
    await enableSync('user-2');
    await putSettings(devHeaders('user-1'), { version: 0, fields: { hideLabels: { value: true, updatedAt: AT } } });
    await putSettings(devHeaders('user-2'), { version: 0, fields: { hideLabels: { value: true, updatedAt: AT } } });
    assert.deepEqual(storedUserIds().sort(), ['user-1', 'user-2']);

    await putConsents(app, devHeaders('user-1'), { settings_sync: false });
    assert.deepEqual(storedUserIds(), ['user-2'], 'only the revoking user’s copy is deleted');
    assert.equal((await getSettings(devHeaders('user-1'))).status, 403);
    assert.equal(
      (await putSettings(devHeaders('user-1'), { version: 0, fields: { hideLabels: { value: true, updatedAt: AT } } })).status,
      403,
    );
    assert.deepEqual(storedUserIds(), ['user-2']);

    // Granting again starts from nothing: the old copy does not come back.
    await enableSync('user-1');
    assert.deepEqual(await (await getSettings(devHeaders('user-1'))).json(), { version: 0, updatedAt: null, fields: {} });
  });

  it('requires authentication', async () => {
    const previous = process.env.VOXA_DEV_AUTH;
    process.env.VOXA_DEV_AUTH = 'false';
    try {
      assert.equal((await getSettings({})).status, 401);
      assert.equal((await putSettings({}, { version: 0, fields: {} })).status, 401);
    } finally {
      process.env.VOXA_DEV_AUTH = previous;
    }
  });

  it('parses If-Match', () => {
    assert.equal(parseIfMatch('"3"'), 3);
    assert.equal(parseIfMatch('W/"3"'), 3);
    assert.equal(parseIfMatch('3'), 3);
    assert.equal(parseIfMatch('*'), null);
    assert.equal(parseIfMatch(undefined), null);
    assert.equal(parseIfMatch('"x"'), null);
  });
});
