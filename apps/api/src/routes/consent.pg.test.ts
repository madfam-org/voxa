import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import app from '../app.js';
import { closeSharedDb, createDb, getSharedDb } from '../db/client.js';
import {
  purgeExpiredUtteranceText,
  UTTERANCE_PURGE_LOCK_KEY,
  UTTERANCE_TEXT_RETENTION_DAYS,
} from '../lib/utterance-retention.js';
import { initStore } from '../store/index.js';
import { putConsents } from '../test-support/consents.js';
import { startTestTokenIssuer, type TestTokenIssuer } from '../test-support/janua-tokens.js';

/**
 * Consent enforcement, counts-only activations and the utterance-text
 * retention purge against a real PostgreSQL. Runs when VOXA_TEST_DATABASE_URL
 * is set (a throwaway database: it migrates and writes there) and skips
 * itself otherwise.
 */
const testDatabaseUrl = process.env.VOXA_TEST_DATABASE_URL?.trim();
const skip = testDatabaseUrl ? false : 'VOXA_TEST_DATABASE_URL is not set';

// Unique per run: the throwaway database may keep rows from an earlier run.
const RUN = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
const DPA_ORG = `org-dpa-${RUN}`;
const OTHER_ORG = `org-other-${RUN}`;

describe('consent and activations on PostgreSQL', { skip }, () => {
  let issuer: TestTokenIssuer;

  before(async () => {
    issuer = await startTestTokenIssuer();
    process.env.DATABASE_URL = testDatabaseUrl;
    assert.equal(await initStore(), 'postgres');
  });

  after(async () => {
    delete process.env.VOXA_UTTERANCE_TEXT_DPA_ORG_IDS;
    await closeSharedDb();
    await issuer.close();
  });

  function db() {
    return getSharedDb(testDatabaseUrl!).client;
  }

  async function createBoard(headers: Record<string, string>, boardId: string): Promise<void> {
    const res = await app.request('/v1/boards', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: boardId,
        name: `Board ${boardId}`,
        profileId: 'default',
        version: 1,
        updatedAt: new Date().toISOString(),
        grid: { rows: 2, columns: 2, buttons: [] },
      }),
    });
    assert.equal(res.status, 201, await res.text());
  }

  // Strictly increasing recordedAt, so rows read back in insertion order.
  let seq = 0;
  const base = Date.now() - 60_000;
  function activate(headers: Record<string, string>, boardId: string, speechText = 'I want juice') {
    seq += 1;
    const recordedAt = new Date(base + seq * 10).toISOString();
    return app.request('/v1/events/activations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ boardId, buttonId: 'want', speechText, recordedAt }),
    });
  }

  async function rows(boardId: string) {
    const result = await db()<
      Array<{ speech_text: string | null; speech_text_consented: boolean }>
    >`
      select speech_text, speech_text_consented from activation_events
       where board_id = ${boardId} order by recorded_at`;
    // Plain objects in a plain array, so deepEqual compares values only.
    return result.map((row) => ({ ...row }));
  }

  it('stores counts only, and text only with utterance_text from an allow-listed organization', async () => {
    delete process.env.VOXA_UTTERANCE_TEXT_DPA_ORG_IDS;
    const userId = `user-${RUN}`;
    const boardId = `consent-board-${RUN}`;
    const user = await issuer.bearer({ sub: userId, roles: [], org_id: DPA_ORG });
    await createBoard(user, boardId);

    // No consent: refused, nothing stored.
    assert.equal((await activate(user, boardId)).status, 403);
    assert.equal((await rows(boardId)).length, 0);

    // usage_analytics: a count row with no text.
    await putConsents(app, user, { usage_analytics: true });
    assert.equal((await activate(user, boardId)).status, 201);
    assert.deepEqual(await rows(boardId), [{ speech_text: null, speech_text_consented: false }]);

    // utterance_text granted, organization not allow-listed: still no text.
    await putConsents(app, user, { utterance_text: true });
    assert.equal((await activate(user, boardId)).status, 201);
    assert.equal((await rows(boardId))[1]?.speech_text, null);

    // Organization allow-listed AND utterance_text granted: text is kept and marked.
    process.env.VOXA_UTTERANCE_TEXT_DPA_ORG_IDS = DPA_ORG;
    const stored = await activate(user, boardId);
    assert.equal(stored.status, 201);
    assert.deepEqual(await stored.json(), { ok: true, textStored: true });
    assert.deepEqual((await rows(boardId))[2], {
      speech_text: 'I want juice',
      speech_text_consented: true,
    });

    // Allow-listed organization, but this user revoked utterance_text: no text.
    await putConsents(app, user, { utterance_text: false });
    assert.equal((await activate(user, boardId)).status, 201);
    assert.equal((await rows(boardId))[3]?.speech_text, null);

    // The decisions and their audit trail are in the database.
    const records = await db()<Array<{ purpose: string; granted: boolean }>>`
      select purpose, granted from consents where user_id = ${userId} order by purpose`;
    assert.deepEqual(
      records.map((r) => [r.purpose, r.granted]),
      [
        ['usage_analytics', true],
        ['utterance_text', false],
      ],
    );
    const events = await db()<Array<{ count: number }>>`
      select count(*)::int as count from consent_events where user_id = ${userId}`;
    assert.equal(events[0]?.count, 3);
  });

  it('keeps no text for a user of another organization even with utterance_text', async () => {
    process.env.VOXA_UTTERANCE_TEXT_DPA_ORG_IDS = DPA_ORG;
    const boardId = `other-board-${RUN}`;
    const user = await issuer.bearer({ sub: `other-${RUN}`, roles: [], org_id: OTHER_ORG });
    await createBoard(user, boardId);
    await putConsents(app, user, { usage_analytics: true, utterance_text: true });
    assert.equal((await activate(user, boardId)).status, 201);
    assert.deepEqual(await rows(boardId), [{ speech_text: null, speech_text_consented: false }]);
  });

  it('predict answers 403 without ai_processing and 200 from the local predictor with it', async () => {
    const user = await issuer.bearer({ sub: `ai-${RUN}`, roles: [] });
    const predict = () =>
      app.request('/v1/ai/predict/text', {
        method: 'POST',
        headers: user,
        body: JSON.stringify({
          profileId: 'p1',
          recentUtterances: [],
          partialText: 'I',
          locale: 'en-US',
        }),
      });
    assert.equal((await predict()).status, 403);
    await putConsents(app, user, { ai_processing: true });
    const ok = await predict();
    assert.equal(ok.status, 200);
    assert.equal(((await ok.json()) as { source: string }).source, 'local');
  });

  it('lets only the board owner delete its activation history', async () => {
    const ownerId = `owner-${RUN}`;
    const boardId = `delete-board-${RUN}`;
    const owner = await issuer.bearer({ sub: ownerId, roles: [], org_id: OTHER_ORG });
    const orgAdmin = await issuer.bearer({
      sub: `admin-${RUN}`,
      roles: ['voxa:admin'],
      org_id: OTHER_ORG,
    });
    await createBoard(owner, boardId);
    await putConsents(app, owner, { usage_analytics: true });
    assert.equal((await activate(owner, boardId)).status, 201);
    assert.equal((await activate(owner, boardId)).status, 201);

    const del = (headers: Record<string, string>) =>
      app.request(`/v1/events/activations?boardId=${boardId}`, { method: 'DELETE', headers });
    assert.equal((await del(orgAdmin)).status, 403);
    assert.equal((await rows(boardId)).length, 2);
    const res = await del(owner);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, deleted: 2 });
    assert.equal((await rows(boardId)).length, 0);
  });

  it('the retention purge clears only opted-in text older than the retention period', async () => {
    const boardId = `purge-board-${RUN}`;
    const owner = await issuer.bearer({ sub: `purge-${RUN}`, roles: [] });
    await createBoard(owner, boardId);

    const day = 24 * 60 * 60 * 1000;
    const now = new Date();
    const old = new Date(now.getTime() - (UTTERANCE_TEXT_RETENTION_DAYS + 10) * day).toISOString();
    const recent = new Date(now.getTime() - 10 * day).toISOString();
    const seed = [
      { id: `old-optin-${RUN}`, text: 'old opted-in', consented: true, at: old },
      { id: `recent-optin-${RUN}`, text: 'recent opted-in', consented: true, at: recent },
      { id: `old-legacy-${RUN}`, text: 'old legacy', consented: false, at: old },
    ];
    for (const row of seed) {
      await db()`
        insert into activation_events (id, board_id, button_id, user_id, speech_text, speech_text_consented, recorded_at)
        values (${row.id}, ${boardId}, 'want', 'seed', ${row.text}, ${row.consented}, ${row.at})`;
    }

    const { db: drizzleDb } = getSharedDb(testDatabaseUrl!);
    const result = await purgeExpiredUtteranceText(drizzleDb, { now });
    assert.equal(result.skipped, false);
    assert.ok(!result.skipped && result.cleared >= 1);

    const after = await db()<Array<{ id: string; speech_text: string | null }>>`
      select id, speech_text from activation_events where board_id = ${boardId} order by id`;
    const byId = Object.fromEntries(after.map((r) => [r.id, r.speech_text]));
    assert.equal(byId[`old-optin-${RUN}`], null, 'opted-in text past retention is cleared');
    assert.equal(
      byId[`recent-optin-${RUN}`],
      'recent opted-in',
      'opted-in text within retention is kept',
    );
    assert.equal(
      byId[`old-legacy-${RUN}`],
      'old legacy',
      'rows written before server-side consent are untouched',
    );
    assert.equal(after.length, 3, 'the purge clears text but keeps the count rows');
  });

  it('the retention purge skips while another replica holds the lock', async () => {
    const other = createDb(testDatabaseUrl!, { max: 1 });
    try {
      await other.client`select pg_advisory_lock(${UTTERANCE_PURGE_LOCK_KEY.toString()}::bigint)`;
      const { db: drizzleDb } = getSharedDb(testDatabaseUrl!);
      assert.deepEqual(await purgeExpiredUtteranceText(drizzleDb), { skipped: true });
      await other.client`select pg_advisory_unlock(${UTTERANCE_PURGE_LOCK_KEY.toString()}::bigint)`;
      assert.equal((await purgeExpiredUtteranceText(drizzleDb)).skipped, false);
    } finally {
      await other.client.end();
    }
  });
});
