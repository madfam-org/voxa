import { SYNCED_SETTINGS_MAX_BYTES, validateSyncedFields, type SyncedSettingsDocument } from '@voxa/core';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { hasConsent } from '../lib/consents.js';
import { deleteUserSettings, getUserSettings, putUserSettings } from '../lib/user-settings.js';

/**
 * `GET/PUT /v1/me/settings`: the signed-in user's own communicator settings
 * document. The user id always comes from the verified token; there is no
 * route that names another user, so nobody (an organization admin included)
 * can read or write someone else's settings.
 *
 * Both methods need the `settings_sync` consent (access settings can reveal a
 * disability). Without it they answer 403 `CONSENT_REQUIRED`, and a write
 * also makes sure no stored copy is left.
 *
 * PUT replaces the document and must name the version it was based on, in
 * `If-Match` (`"3"`) or as `version` in the body; a stale version answers 409
 * `VERSION_CONFLICT` with the current document, so the client can merge and
 * retry. Fields are allow-listed and checked (`@voxa/core` synced-settings):
 * unknown field or bad value 400, more than SYNCED_SETTINGS_MAX_BYTES 413 (the
 * body ceiling for this route, src/middleware/body-limit.ts, answers 413 first).
 */
export const meSettingsRoutes = new Hono();

const CONSENT_REQUIRED = {
  error: 'Settings sync needs the settings_sync consent',
  code: 'CONSENT_REQUIRED',
  purpose: 'settings_sync',
} as const;

function respond(c: Context, document: SyncedSettingsDocument, status: 200 | 409 = 200) {
  c.header('ETag', `"${document.version}"`);
  c.header('Cache-Control', 'no-store');
  return status === 409
    ? c.json({ error: 'The settings changed since that version', code: 'VERSION_CONFLICT', current: document }, 409)
    : c.json(document, 200);
}

/** `"3"`, `W/"3"` or `3` → 3; anything else → null. */
export function parseIfMatch(header: string | undefined): number | null {
  if (!header) return null;
  const match = /^(?:W\/)?"?(\d{1,9})"?$/.exec(header.trim());
  return match ? Number(match[1]) : null;
}

meSettingsRoutes.get('/', async (c) => {
  const { userId } = c.get('team');
  if (!(await hasConsent(process.env.DATABASE_URL, userId, 'settings_sync'))) {
    return c.json(CONSENT_REQUIRED, 403);
  }
  return respond(c, await getUserSettings(process.env.DATABASE_URL, userId));
});

meSettingsRoutes.put('/', async (c) => {
  const { userId } = c.get('team');
  if (!(await hasConsent(process.env.DATABASE_URL, userId, 'settings_sync'))) {
    await deleteUserSettings(process.env.DATABASE_URL, userId);
    return c.json(CONSENT_REQUIRED, 403);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'JSON body required', code: 'INVALID_BODY' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be { "fields": { … } }', code: 'INVALID_BODY' }, 400);
  }
  const { fields, version, ...extra } = body as Record<string, unknown>;
  const unknownKeys = Object.keys(extra);
  if (unknownKeys.length > 0) {
    return c.json({ error: `Unknown body field: ${unknownKeys[0]}`, code: 'UNKNOWN_FIELD' }, 400);
  }

  const headerVersion = parseIfMatch(c.req.header('If-Match'));
  const bodyVersion = typeof version === 'number' && Number.isInteger(version) && version >= 0 ? version : null;
  if (version !== undefined && bodyVersion === null) {
    return c.json({ error: 'version must be a non-negative integer', code: 'INVALID_BODY' }, 400);
  }
  if (headerVersion !== null && bodyVersion !== null && headerVersion !== bodyVersion) {
    return c.json({ error: 'If-Match and version disagree', code: 'INVALID_BODY' }, 400);
  }
  const expectedVersion = headerVersion ?? bodyVersion;
  if (expectedVersion === null) {
    return c.json(
      { error: 'Name the version this write is based on (If-Match or version)', code: 'PRECONDITION_REQUIRED' },
      428,
    );
  }

  const checked = validateSyncedFields(fields);
  if (!checked.ok) {
    const { problem } = checked;
    if (problem.code === 'TOO_LARGE') {
      return c.json(
        { error: 'Settings document too large', code: 'PAYLOAD_TOO_LARGE', maxBytes: SYNCED_SETTINGS_MAX_BYTES },
        413,
      );
    }
    return c.json({ error: 'Invalid settings', ...problem }, 400);
  }

  const result = await putUserSettings(process.env.DATABASE_URL, userId, expectedVersion, checked.fields);
  return result.ok ? respond(c, result.document) : respond(c, result.current, 409);
});
