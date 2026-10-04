import {
  isValidSyncedSettingValue,
  parseSyncedSettingsDocument,
  SYNCED_SETTING_KEYS,
  type SyncedSettingFields,
  type SyncedSettingKey,
  type SyncedSettingsDocument,
  type SyncedSettingValue,
} from '@voxa/core';
import { apiFetch } from './api-client';
import type { CommunicatorSettings } from './communicator-settings';

/**
 * Settings that follow the user between devices (opt-in, consent
 * `settings_sync`).
 *
 * Local first: the communicator always reads and writes its settings in this
 * device's storage and never waits for the network. With the consent on, the
 * signed-in device pulls the server copy on start, merges it field by field
 * (the newer change wins), and pushes its own changes after a short pause;
 * offline changes wait in a queue (`dirty`) until the device is back online.
 *
 * Only the allow-listed fields of `@voxa/core` (SYNCED_SETTING_KEYS) are ever
 * sent. The chosen voice (`voiceURIByLocale`) stays on the device: installed
 * voices differ from one device to another. Rate, pitch and volume do sync.
 */

/** Device-wide: when each synced field last changed here, and whether a push is owed. */
export const SETTINGS_SYNC_STATE_KEY = 'voxa-settings-sync-state';
/** Per user: the consent as last known on this device, and the server version last seen. */
export const SETTINGS_SYNC_USER_KEY_PREFIX = 'voxa-settings-sync';

/** Fields never changed on this device count as older than any server change. */
export const NEVER_CHANGED = '1970-01-01T00:00:00.000Z';
export const PUSH_DEBOUNCE_MS = 1500;
/** Fired after a local change to a synced field (settings sync pushes after a pause). */
export const SETTINGS_LOCAL_CHANGE_EVENT = 'voxa-settings-local-change';
export const MAX_CONFLICT_RETRIES = 3;

export type FieldTimes = Partial<Record<SyncedSettingKey, string>>;

export interface SettingsSyncState {
  fieldTimes: FieldTimes;
  /** A local change has not reached the server yet. */
  dirty: boolean;
}

export interface SettingsSyncUserState {
  /** The `settings_sync` consent as last read from or written to the API. */
  enabled: boolean;
  /** Server document version this device last saw (0 = none). */
  version: number;
}

export type SyncedValues = Partial<Record<SyncedSettingKey, SyncedSettingValue>>;

function timeOf(iso: string | undefined): number {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

/** The synced fields of a settings object (never `voiceURIByLocale` or other device-only fields). */
export function syncedValues(settings: CommunicatorSettings): SyncedValues {
  const out: SyncedValues = {};
  for (const key of SYNCED_SETTING_KEYS) out[key] = settings[key];
  return out;
}

/**
 * Records `now` for every synced field whose value differs between `prev`
 * and `next`. Returns null when no synced field changed.
 */
export function stampChangedFields(
  prev: CommunicatorSettings,
  next: CommunicatorSettings,
  times: FieldTimes,
  now: string,
): FieldTimes | null {
  let changed = false;
  const out: FieldTimes = { ...times };
  for (const key of SYNCED_SETTING_KEYS) {
    if (prev[key] !== next[key]) {
      out[key] = now;
      changed = true;
    }
  }
  return changed ? out : null;
}

export interface MergeResult {
  /** False when the server document was malformed and was ignored. */
  valid: boolean;
  /** Values to apply locally (server changes newer than this device's). */
  patch: Partial<CommunicatorSettings>;
  /** This device's field times after the merge. */
  fieldTimes: FieldTimes;
  /** This device holds a change the server does not have. */
  needsPush: boolean;
  /** Server version the merge was based on (to send with the push). */
  version: number;
}

/**
 * Per-field last writer wins. For each synced field: the server value is
 * taken when it changed later than this device's value (a field never changed
 * here always loses); otherwise the local value stays, and a push is owed when
 * the server lacks the field or holds an older change. A malformed document,
 * or an entry that fails its rule, is ignored.
 */
export function mergeSyncedSettings(
  local: CommunicatorSettings,
  times: FieldTimes,
  serverDocument: unknown,
): MergeResult {
  const doc = parseSyncedSettingsDocument(serverDocument);
  if (!doc) return { valid: false, patch: {}, fieldTimes: times, needsPush: false, version: 0 };

  const patch: Record<string, SyncedSettingValue> = {};
  const fieldTimes: FieldTimes = { ...times };
  let needsPush = false;
  for (const key of SYNCED_SETTING_KEYS) {
    const remote = doc.fields[key];
    const localTime = timeOf(times[key]);
    if (remote && timeOf(remote.updatedAt) >= localTime) {
      if (local[key] !== remote.value) patch[key] = remote.value;
      fieldTimes[key] = remote.updatedAt;
    } else if (!remote || timeOf(remote.updatedAt) < localTime) {
      needsPush = true;
    }
  }
  return {
    valid: true,
    patch: patch as Partial<CommunicatorSettings>,
    fieldTimes,
    needsPush,
    version: doc.version,
  };
}

/**
 * The document fields this device sends: every synced field with its change
 * time. A local value outside the shared rules (an old stored value) stays on
 * the device rather than making the server refuse the whole document.
 */
export function buildPushFields(settings: CommunicatorSettings, times: FieldTimes): SyncedSettingFields {
  const fields: SyncedSettingFields = {};
  for (const key of SYNCED_SETTING_KEYS) {
    const value = settings[key];
    if (!isValidSyncedSettingValue(key, value)) continue;
    fields[key] = { value, updatedAt: times[key] ?? NEVER_CHANGED };
  }
  return fields;
}

/**
 * Field times after a successful push: the server's time for every field that
 * did not change on this device while the push was in flight (the server may
 * have replaced a future time with its own), the newer local time otherwise.
 */
export function timesAfterPush(
  fields: Record<string, { updatedAt: string } | undefined>,
  sent: FieldTimes,
  latest: FieldTimes,
): FieldTimes {
  const out: FieldTimes = { ...latest };
  for (const [key, entry] of Object.entries(fields)) {
    const k = key as keyof FieldTimes;
    if (entry && latest[k] === sent[k]) out[k] = entry.updatedAt;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Device storage (every access guarded: storage may be unavailable).

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: sync state is rebuilt from the server next time */
  }
}

export function readSyncState(): SettingsSyncState {
  if (typeof window === 'undefined') return { fieldTimes: {}, dirty: false };
  const raw = readJson(SETTINGS_SYNC_STATE_KEY) as Partial<SettingsSyncState> | null;
  const fieldTimes: FieldTimes = {};
  if (raw?.fieldTimes && typeof raw.fieldTimes === 'object') {
    for (const key of SYNCED_SETTING_KEYS) {
      const value = (raw.fieldTimes as Record<string, unknown>)[key];
      if (typeof value === 'string' && Number.isFinite(Date.parse(value))) fieldTimes[key] = value;
    }
  }
  return { fieldTimes, dirty: raw?.dirty === true };
}

export function writeSyncState(state: SettingsSyncState): void {
  if (typeof window === 'undefined') return;
  writeJson(SETTINGS_SYNC_STATE_KEY, state);
}

export function settingsSyncUserKey(userId: string): string {
  return `${SETTINGS_SYNC_USER_KEY_PREFIX}:${userId}`;
}

export function readSyncUserState(userId: string): SettingsSyncUserState {
  if (typeof window === 'undefined') return { enabled: false, version: 0 };
  const raw = readJson(settingsSyncUserKey(userId)) as Partial<SettingsSyncUserState> | null;
  return {
    enabled: raw?.enabled === true,
    version: typeof raw?.version === 'number' && Number.isInteger(raw.version) && raw.version >= 0 ? raw.version : 0,
  };
}

export function writeSyncUserState(userId: string, state: SettingsSyncUserState): void {
  if (typeof window === 'undefined') return;
  writeJson(settingsSyncUserKey(userId), state);
}

// ---------------------------------------------------------------------------
// API calls (through the API client). None of them throws.

export type ConsentRead = { kind: 'ok'; enabled: boolean } | { kind: 'signed-out' } | { kind: 'unreachable' };

/** The user's `settings_sync` consent as the API holds it. */
export async function fetchSettingsSyncConsent(): Promise<ConsentRead> {
  try {
    const res = await apiFetch('/v1/consents');
    if (res.status === 401) return { kind: 'signed-out' };
    if (!res.ok) return { kind: 'unreachable' };
    const view = (await res.json()) as { consents?: Array<{ purpose?: string; granted?: boolean }> };
    const record = view.consents?.find((c) => c.purpose === 'settings_sync');
    return { kind: 'ok', enabled: record?.granted === true };
  } catch {
    return { kind: 'unreachable' };
  }
}

/** Records the consent decision; true when the API confirmed it. */
export async function saveSettingsSyncConsent(enabled: boolean): Promise<boolean> {
  try {
    const res = await apiFetch('/v1/consents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consents: { settings_sync: enabled } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type PullResult =
  | { kind: 'ok'; document: unknown }
  | { kind: 'consent-required' }
  | { kind: 'signed-out' }
  | { kind: 'unreachable' };

export async function pullSyncedSettings(): Promise<PullResult> {
  try {
    const res = await apiFetch('/v1/me/settings');
    if (res.status === 401) return { kind: 'signed-out' };
    if (res.status === 403) return { kind: 'consent-required' };
    if (!res.ok) return { kind: 'unreachable' };
    return { kind: 'ok', document: (await res.json()) as unknown };
  } catch {
    return { kind: 'unreachable' };
  }
}

export type PushResult =
  | { kind: 'ok'; document: SyncedSettingsDocument }
  | { kind: 'conflict'; current: unknown }
  | { kind: 'consent-required' }
  | { kind: 'signed-out' }
  | { kind: 'rejected' }
  | { kind: 'unreachable' };

export async function pushSyncedSettings(version: number, fields: SyncedSettingFields): Promise<PushResult> {
  try {
    // The version travels in the body (also accepted as If-Match by the API).
    const res = await apiFetch('/v1/me/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, fields }),
    });
    if (res.status === 401) return { kind: 'signed-out' };
    if (res.status === 403) return { kind: 'consent-required' };
    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as { current?: unknown } | null;
      return { kind: 'conflict', current: body?.current };
    }
    if (res.status === 400 || res.status === 413 || res.status === 428) return { kind: 'rejected' };
    if (!res.ok) return { kind: 'unreachable' };
    const doc = parseSyncedSettingsDocument(await res.json());
    return doc ? { kind: 'ok', document: doc } : { kind: 'unreachable' };
  } catch {
    return { kind: 'unreachable' };
  }
}
