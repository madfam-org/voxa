/**
 * Communicator settings that may follow a signed-in user between devices
 * (`GET/PUT /v1/me/settings`), only with the `settings_sync` consent.
 *
 * This is an allow-list: a field not listed here is never stored on the
 * server, and every value is checked against its rule. Device-specific
 * choices stay on the device: the chosen voice (`voiceURIByLocale`, installed
 * voices differ per device), the user-interface language (it follows the
 * page address), and one-time notices.
 *
 * The web app (`apps/web/src/lib/settings-sync.ts`) and the API
 * (`apps/api/src/lib/user-settings.ts`) share these rules, so a value the API
 * accepts is one the communicator can use.
 */

type FieldRule =
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'number'; min: number; max: number; integer?: boolean }
  | { kind: 'boolean' };

const enumOf = (...values: string[]): FieldRule => ({ kind: 'enum', values });
const range = (min: number, max: number, integer = false): FieldRule => ({ kind: 'number', min, max, integer });
const flag: FieldRule = { kind: 'boolean' };

/**
 * Ranges match the settings UI (`@voxa/access` constants and the speech
 * tuning bounds in the web app); `apps/web/src/lib/settings-sync.test.ts`
 * checks they stay equal.
 */
export const SYNCED_SETTING_RULES = {
  contentLocale: enumOf('es-MX', 'en-US', 'fr-FR'),
  accessMode: enumOf('touch', 'switch', 'eye-tracking'),
  cviTheme: enumOf('default', 'cvi-dark', 'cvi-high-contrast', 'classic-light'),
  targetScale: range(0.5, 3),
  switchIntervalMs: range(300, 5000),
  switchOrder: enumOf('row-major', 'column-major', 'linear'),
  switchGroupStrategy: enumOf('none', 'rows', 'regions'),
  switchScanMode: enumOf('auto', 'step'),
  switchGroupCycles: range(1, 5, true),
  switchFirstItemHoldMs: range(0, 3000),
  switchAcceptanceMs: range(0, 1000),
  switchPostSelectionPauseMs: range(0, 3000),
  eyeDwellMs: range(500, 3000),
  gazeSource: enumOf('pointer', 'event-bridge'),
  auditoryScanHighlight: flag,
  auditoryScanVoice: flag,
  auditoryScanBeep: flag,
  pauseScanWhileSpeaking: flag,
  touchActivation: enumOf('press', 'release'),
  touchGuardEnabled: flag,
  touchGuardMask: enumOf('gutter', 'perimeter', 'both'),
  whisperMode: flag,
  hideSymbols: flag,
  hideLabels: flag,
  spanishAgreement: flag,
  speechRate: range(0.5, 2),
  speechPitch: range(0.5, 2),
  speechVolume: range(0, 1),
} as const satisfies Record<string, FieldRule>;

export type SyncedSettingKey = keyof typeof SYNCED_SETTING_RULES;
export type SyncedSettingValue = string | number | boolean;

export const SYNCED_SETTING_KEYS = Object.keys(SYNCED_SETTING_RULES) as SyncedSettingKey[];

/** One synced field: its value and when it was last changed on a device. */
export interface SyncedSettingEntry {
  value: SyncedSettingValue;
  /** ISO 8601 time of the change (per-field last writer wins). */
  updatedAt: string;
}

export type SyncedSettingFields = Partial<Record<SyncedSettingKey, SyncedSettingEntry>>;

/** The stored document, as `GET /v1/me/settings` answers it. */
export interface SyncedSettingsDocument {
  /** 0 when nothing is stored yet; every accepted write adds 1. */
  version: number;
  /** Server time of the last write, or null when nothing is stored. */
  updatedAt: string | null;
  fields: SyncedSettingFields;
}

/** Ceiling for the serialized `fields` object (the allow-list keeps real documents far below it). */
export const SYNCED_SETTINGS_MAX_BYTES = 8 * 1024;

const MAX_TIMESTAMP_LENGTH = 40;

export function isSyncedSettingKey(value: unknown): value is SyncedSettingKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SYNCED_SETTING_RULES, value);
}

export function isValidSyncedSettingValue(key: SyncedSettingKey, value: unknown): value is SyncedSettingValue {
  const rule: FieldRule = SYNCED_SETTING_RULES[key];
  switch (rule.kind) {
    case 'enum':
      return typeof value === 'string' && rule.values.includes(value);
    case 'number':
      return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= rule.min &&
        value <= rule.max &&
        (!rule.integer || Number.isInteger(value))
      );
    case 'boolean':
      return typeof value === 'boolean';
  }
}

export function isValidSyncTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_TIMESTAMP_LENGTH && Number.isFinite(Date.parse(value));
}

export type SyncedFieldsProblem =
  | { code: 'NOT_AN_OBJECT' }
  | { code: 'UNKNOWN_FIELD'; field: string }
  | { code: 'INVALID_VALUE'; field: SyncedSettingKey }
  | { code: 'INVALID_TIMESTAMP'; field: SyncedSettingKey }
  | { code: 'TOO_LARGE' };

/**
 * Strict check of a `fields` object sent by a client: every key on the
 * allow-list, every value valid, every entry exactly `{ value, updatedAt }`.
 */
export function validateSyncedFields(
  input: unknown,
): { ok: true; fields: SyncedSettingFields } | { ok: false; problem: SyncedFieldsProblem } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, problem: { code: 'NOT_AN_OBJECT' } };
  }
  const fields: SyncedSettingFields = {};
  for (const [key, entry] of Object.entries(input as Record<string, unknown>)) {
    if (!isSyncedSettingKey(key)) return { ok: false, problem: { code: 'UNKNOWN_FIELD', field: key } };
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, problem: { code: 'INVALID_VALUE', field: key } };
    }
    const { value, updatedAt, ...extra } = entry as Record<string, unknown>;
    if (Object.keys(extra).length > 0 || !isValidSyncedSettingValue(key, value)) {
      return { ok: false, problem: { code: 'INVALID_VALUE', field: key } };
    }
    if (!isValidSyncTimestamp(updatedAt)) {
      return { ok: false, problem: { code: 'INVALID_TIMESTAMP', field: key } };
    }
    fields[key] = { value, updatedAt };
  }
  // Keys, enum values, numbers and timestamps are all ASCII: length is the byte count.
  if (JSON.stringify(fields).length > SYNCED_SETTINGS_MAX_BYTES) {
    return { ok: false, problem: { code: 'TOO_LARGE' } };
  }
  return { ok: true, fields };
}

/**
 * Lenient read of a stored or received document: entries that fail their
 * rule are dropped, a malformed document reads as null.
 */
export function parseSyncedSettingsDocument(input: unknown): SyncedSettingsDocument | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 0) return null;
  if (raw.updatedAt !== null && !isValidSyncTimestamp(raw.updatedAt)) return null;
  if (!raw.fields || typeof raw.fields !== 'object' || Array.isArray(raw.fields)) return null;
  const fields: SyncedSettingFields = {};
  for (const [key, entry] of Object.entries(raw.fields as Record<string, unknown>)) {
    if (!isSyncedSettingKey(key) || !entry || typeof entry !== 'object') continue;
    const { value, updatedAt } = entry as Record<string, unknown>;
    if (isValidSyncedSettingValue(key, value) && isValidSyncTimestamp(updatedAt)) {
      fields[key] = { value, updatedAt };
    }
  }
  return { version: raw.version, updatedAt: (raw.updatedAt as string | null) ?? null, fields };
}
