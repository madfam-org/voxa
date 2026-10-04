import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { getSharedDb } from '../db/client.js';
import { consentEvents, consents } from '../db/schema.js';
import { fileStoreDataDir, writeFileAtomic } from '../store/file-board-store.js';
import { getStoreDriver } from '../store/index.js';

/**
 * Server-side consent records (one per user and purpose).
 *
 * - `ai_processing`: the API may process the message being built to return
 *   word and symbol suggestions (`POST /v1/ai/predict/*`).
 * - `usage_analytics`: the API may record which button was pressed and when
 *   (`POST /v1/events/activations`), as counts, without any text.
 * - `utterance_text`: the API may also keep the spoken text of an activation.
 *   It can be recorded for anyone, but it is honoured only for users whose
 *   organization is on the DPA allow-list (`VOXA_UTTERANCE_TEXT_DPA_ORG_IDS`,
 *   empty by default), and stored text is purged after
 *   UTTERANCE_TEXT_RETENTION_DAYS.
 *
 * No record means "not decided", which is treated as not granted.
 */
export const CONSENT_PURPOSES = ['ai_processing', 'usage_analytics', 'utterance_text'] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** Version of the consent wording the API records with every decision. */
export const CONSENT_POLICY_VERSION = '2026-10-03';

export interface ConsentRecord {
  purpose: ConsentPurpose;
  granted: boolean;
  policyVersion: string;
  grantedAt: string | null;
  revokedAt: string | null;
  updatedAt: string;
}

export function isConsentPurpose(value: unknown): value is ConsentPurpose {
  return typeof value === 'string' && (CONSENT_PURPOSES as readonly string[]).includes(value);
}

/** Organization ids with a signed DPA that may store utterance text. Empty by default. */
export function utteranceTextDpaOrgIds(
  raw: string | undefined = process.env.VOXA_UTTERANCE_TEXT_DPA_ORG_IDS,
): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function orgHasUtteranceTextDpa(orgId: string | undefined): boolean {
  return Boolean(orgId && utteranceTextDpaOrgIds().has(orgId));
}

// ---------------------------------------------------------------------------
// File driver (no DATABASE_URL): consents.json under VOXA_DATA_DIR, replaced
// atomically like boards.json (invariant 5).

interface FileConsentState {
  consents: Record<string, Record<string, ConsentRecord>>;
  events: Array<{
    id: string;
    userId: string;
    purpose: ConsentPurpose;
    granted: boolean;
    policyVersion: string;
    recordedAt: string;
  }>;
}

export function consentStorePath(): string {
  return join(fileStoreDataDir(), 'consents.json');
}

function loadFileState(): FileConsentState {
  const path = consentStorePath();
  if (!existsSync(path)) return { consents: {}, events: [] };
  return JSON.parse(readFileSync(path, 'utf8')) as FileConsentState;
}

function useDatabase(databaseUrl: string | undefined): databaseUrl is string {
  return Boolean(databaseUrl) && getStoreDriver() === 'postgres';
}

// ---------------------------------------------------------------------------

export async function listConsents(
  databaseUrl: string | undefined,
  userId: string,
): Promise<ConsentRecord[]> {
  if (!useDatabase(databaseUrl)) {
    const state = loadFileState();
    return Object.values(state.consents[userId] ?? {}).filter((r) => isConsentPurpose(r.purpose));
  }
  const { db } = getSharedDb(databaseUrl);
  const rows = await db.select().from(consents).where(eq(consents.userId, userId));
  return rows
    .filter((row) => isConsentPurpose(row.purpose))
    .map((row) => ({
      purpose: row.purpose as ConsentPurpose,
      granted: row.granted,
      policyVersion: row.policyVersion,
      grantedAt: row.grantedAt,
      revokedAt: row.revokedAt,
      updatedAt: row.updatedAt,
    }));
}

export async function hasConsent(
  databaseUrl: string | undefined,
  userId: string,
  purpose: ConsentPurpose,
): Promise<boolean> {
  if (!useDatabase(databaseUrl)) {
    return loadFileState().consents[userId]?.[purpose]?.granted === true;
  }
  const { db } = getSharedDb(databaseUrl);
  const rows = await db
    .select({ granted: consents.granted })
    .from(consents)
    .where(and(eq(consents.userId, userId), eq(consents.purpose, purpose)))
    .limit(1);
  return rows[0]?.granted === true;
}

/**
 * Records the caller's decisions. Only purposes whose value changes (or that
 * had no record) are written, and each write appends an audit event with the
 * server time and the current policy version.
 */
export async function setConsents(
  databaseUrl: string | undefined,
  userId: string,
  decisions: Partial<Record<ConsentPurpose, boolean>>,
  now: string = new Date().toISOString(),
): Promise<ConsentRecord[]> {
  const entries = Object.entries(decisions).filter(
    (entry): entry is [ConsentPurpose, boolean] =>
      isConsentPurpose(entry[0]) && typeof entry[1] === 'boolean',
  );
  const current = new Map((await listConsents(databaseUrl, userId)).map((r) => [r.purpose, r]));

  const changed: ConsentRecord[] = [];
  for (const [purpose, granted] of entries) {
    const previous = current.get(purpose);
    if (
      previous &&
      previous.granted === granted &&
      previous.policyVersion === CONSENT_POLICY_VERSION
    ) {
      continue;
    }
    changed.push({
      purpose,
      granted,
      policyVersion: CONSENT_POLICY_VERSION,
      grantedAt: granted ? now : (previous?.grantedAt ?? null),
      revokedAt: granted ? null : now,
      updatedAt: now,
    });
  }

  if (changed.length > 0) {
    if (!useDatabase(databaseUrl)) {
      const state = loadFileState();
      const mine = (state.consents[userId] ??= {});
      for (const record of changed) {
        mine[record.purpose] = record;
        state.events.push({
          id: randomUUID(),
          userId,
          purpose: record.purpose,
          granted: record.granted,
          policyVersion: record.policyVersion,
          recordedAt: now,
        });
      }
      writeFileAtomic(consentStorePath(), JSON.stringify(state, null, 2));
    } else {
      const { db } = getSharedDb(databaseUrl);
      await db.transaction(async (tx) => {
        for (const record of changed) {
          await tx
            .insert(consents)
            .values({ userId, ...record })
            .onConflictDoUpdate({
              target: [consents.userId, consents.purpose],
              set: {
                granted: record.granted,
                policyVersion: record.policyVersion,
                grantedAt: record.grantedAt,
                revokedAt: record.revokedAt,
                updatedAt: record.updatedAt,
              },
            });
          await tx.insert(consentEvents).values({
            id: randomUUID(),
            userId,
            purpose: record.purpose,
            granted: record.granted,
            policyVersion: record.policyVersion,
            recordedAt: now,
          });
        }
      });
    }
  }

  return listConsents(databaseUrl, userId);
}

/** Test helper: the file driver's audit trail. */
export function fileConsentEventsForTests(): FileConsentState['events'] {
  return loadFileState().events;
}
