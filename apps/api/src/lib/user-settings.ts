import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseSyncedSettingsDocument,
  type SyncedSettingFields,
  type SyncedSettingsDocument,
} from '@voxa/core';
import { and, eq } from 'drizzle-orm';
import { getSharedDb } from '../db/client.js';
import { userSettings } from '../db/schema.js';
import { fileStoreDataDir, writeFileAtomic } from '../store/file-board-store.js';
import { getStoreDriver } from '../store/index.js';

/**
 * Communicator settings that follow the user between devices: one versioned
 * document per user (`GET/PUT /v1/me/settings`), written only while the user's
 * `settings_sync` consent is granted, and deleted when it is revoked.
 *
 * Writes are compare-and-set on `version` (like board writes, invariant 13):
 * a write names the version it was based on and wins only if that is still
 * the stored version; otherwise the caller gets the current document.
 * Validation (allow-list, value rules, size) happens in the route, through
 * `validateSyncedFields` from `@voxa/core`.
 */

export const EMPTY_SETTINGS_DOCUMENT: SyncedSettingsDocument = { version: 0, updatedAt: null, fields: {} };

export type SettingsWriteResult =
  | { ok: true; document: SyncedSettingsDocument }
  | { ok: false; current: SyncedSettingsDocument };

/**
 * Field times come from devices, whose clocks may run ahead. A time in the
 * future would make that field win every merge until the clock catches up,
 * so it is stored as the server time instead.
 */
export function clampFieldTimes(fields: SyncedSettingFields, now: string): SyncedSettingFields {
  const limit = Date.parse(now);
  const out: SyncedSettingFields = {};
  for (const [key, entry] of Object.entries(fields) as Array<[keyof SyncedSettingFields, NonNullable<SyncedSettingFields[keyof SyncedSettingFields]>]>) {
    out[key] = Date.parse(entry.updatedAt) > limit ? { value: entry.value, updatedAt: now } : entry;
  }
  return out;
}

// ---------------------------------------------------------------------------
// File driver (no DATABASE_URL): user-settings.json under VOXA_DATA_DIR,
// replaced atomically like boards.json (invariant 5).

type FileSettingsState = Record<string, SyncedSettingsDocument>;

export function userSettingsStorePath(): string {
  return join(fileStoreDataDir(), 'user-settings.json');
}

function loadFileState(): FileSettingsState {
  const path = userSettingsStorePath();
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8')) as FileSettingsState;
}

function useDatabase(databaseUrl: string | undefined): databaseUrl is string {
  return Boolean(databaseUrl) && getStoreDriver() === 'postgres';
}

function fromRow(row: { version: number; fields: unknown; updatedAt: string }): SyncedSettingsDocument {
  return (
    parseSyncedSettingsDocument({ version: row.version, updatedAt: row.updatedAt, fields: row.fields }) ?? {
      ...EMPTY_SETTINGS_DOCUMENT,
      version: row.version,
    }
  );
}

// ---------------------------------------------------------------------------

export async function getUserSettings(
  databaseUrl: string | undefined,
  userId: string,
): Promise<SyncedSettingsDocument> {
  if (!useDatabase(databaseUrl)) {
    const stored = loadFileState()[userId];
    return (stored && parseSyncedSettingsDocument(stored)) || EMPTY_SETTINGS_DOCUMENT;
  }
  const { db } = getSharedDb(databaseUrl);
  const rows = await db
    .select({ version: userSettings.version, fields: userSettings.fields, updatedAt: userSettings.updatedAt })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return rows[0] ? fromRow(rows[0]) : EMPTY_SETTINGS_DOCUMENT;
}

/**
 * Replaces the user's document if `expectedVersion` is still the stored
 * version (0 = nothing stored yet). The new version is `expectedVersion + 1`.
 */
export async function putUserSettings(
  databaseUrl: string | undefined,
  userId: string,
  expectedVersion: number,
  fields: SyncedSettingFields,
  now: string = new Date().toISOString(),
): Promise<SettingsWriteResult> {
  const stored = clampFieldTimes(fields, now);
  const next: SyncedSettingsDocument = { version: expectedVersion + 1, updatedAt: now, fields: stored };

  if (!useDatabase(databaseUrl)) {
    const state = loadFileState();
    const current = (state[userId] && parseSyncedSettingsDocument(state[userId])) || EMPTY_SETTINGS_DOCUMENT;
    if (current.version !== expectedVersion) return { ok: false, current };
    state[userId] = next;
    writeFileAtomic(userSettingsStorePath(), JSON.stringify(state, null, 2));
    return { ok: true, document: next };
  }

  const { db } = getSharedDb(databaseUrl);
  const written =
    expectedVersion === 0
      ? await db
          .insert(userSettings)
          .values({ userId, version: 1, fields: stored, updatedAt: now })
          .onConflictDoNothing({ target: userSettings.userId })
          .returning({ version: userSettings.version })
      : await db
          .update(userSettings)
          .set({ version: next.version, fields: stored, updatedAt: now })
          .where(and(eq(userSettings.userId, userId), eq(userSettings.version, expectedVersion)))
          .returning({ version: userSettings.version });
  if (written.length === 0) {
    return { ok: false, current: await getUserSettings(databaseUrl, userId) };
  }
  return { ok: true, document: next };
}

/** Deletes the user's stored settings (consent revoked). Idempotent. */
export async function deleteUserSettings(databaseUrl: string | undefined, userId: string): Promise<void> {
  if (!useDatabase(databaseUrl)) {
    const state = loadFileState();
    if (!(userId in state)) return;
    delete state[userId];
    writeFileAtomic(userSettingsStorePath(), JSON.stringify(state, null, 2));
    return;
  }
  const { db } = getSharedDb(databaseUrl);
  await db.delete(userSettings).where(eq(userSettings.userId, userId));
}
