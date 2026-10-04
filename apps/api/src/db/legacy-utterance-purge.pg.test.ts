import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { closeSharedDb, getSharedDb, migrationsFolder } from './client.js';
import { initStore } from '../store/index.js';

/**
 * Migration 0005 (purge of utterance text stored before server-side consent)
 * and its count-only dry run, against a real PostgreSQL. Runs when
 * VOXA_TEST_DATABASE_URL is set and skips itself otherwise.
 *
 * The statements run inside a transaction that is rolled back, so this file
 * never changes rows that other PostgreSQL test files (running in parallel on
 * the same database) are asserting on.
 */
const testDatabaseUrl = process.env.VOXA_TEST_DATABASE_URL?.trim();
const skip = testDatabaseUrl ? false : 'VOXA_TEST_DATABASE_URL is not set';
const RUN = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;

const migrationSql = readFileSync(
  join(migrationsFolder(), '0005_purge_legacy_utterance_text.sql'),
  'utf8',
);
const dryRunSql = readFileSync(
  join(process.cwd(), 'scripts/legacy-utterance-text-dry-run.sql'),
  'utf8',
);

class Rollback extends Error {}

describe('legacy utterance text purge (migration 0005)', { skip }, () => {
  before(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    assert.equal(await initStore(), 'postgres');
  });

  after(async () => {
    await closeSharedDb();
  });

  it('dry run returns counts and a date range only; the migration clears only legacy text, idempotently', async () => {
    const { client } = getSharedDb(testDatabaseUrl!);
    const boardId = `legacy-board-${RUN}`;
    const ids = { legacy: `legacy-${RUN}`, consented: `consented-${RUN}`, counts: `counts-${RUN}` };

    await assert.rejects(
      client.begin(async (tx) => {
        await tx`insert into boards (id, name, profile_id, owner_user_id, grid, version, updated_at)
                 values (${boardId}, 'Legacy', 'default', ${`owner-${RUN}`}, '{"rows":1,"columns":1,"buttons":[]}'::jsonb, 1, now())`;
        await tx`insert into activation_events (id, board_id, button_id, user_id, speech_text, speech_text_consented, recorded_at) values
                 (${ids.legacy}, ${boardId}, 'want', 'u', 'legacy text', false, now() - interval '200 days'),
                 (${ids.consented}, ${boardId}, 'want', 'u', 'opted-in text', true, now()),
                 (${ids.counts}, ${boardId}, 'want', 'u', null, false, now())`;

        const [dry] = await tx.unsafe(dryRunSql);
        assert.deepEqual(Object.keys(dry!).sort(), [
          'distinct_boards',
          'distinct_users',
          'earliest',
          'latest',
          'rows_on_demo_board',
          'rows_with_text',
        ]);
        assert.ok(Number(dry!.rows_with_text) >= 1);

        await tx.unsafe(migrationSql);
        const rows = await tx<Array<{ id: string; speech_text: string | null }>>`
          select id, speech_text from activation_events where board_id = ${boardId}`;
        const byId = Object.fromEntries(rows.map((r) => [r.id, r.speech_text]));
        assert.equal(byId[ids.legacy], null, 'text written before server-side consent is cleared');
        assert.equal(
          byId[ids.consented],
          'opted-in text',
          'text kept under utterance_text consent is untouched',
        );
        assert.equal(rows.length, 3, 'count rows are kept');

        const [afterDry] = await tx.unsafe(dryRunSql);
        assert.equal(Number(afterDry!.rows_with_text), 0, 'nothing legacy is left');
        const again = await tx.unsafe(migrationSql);
        assert.equal(again.count, 0, 'a second run changes nothing');

        throw new Rollback();
      }),
      Rollback,
    );
  });

  it('the migration is in the journal, so the startup migrator applies it', () => {
    const journal = JSON.parse(
      readFileSync(join(migrationsFolder(), 'meta/_journal.json'), 'utf8'),
    ) as {
      entries: Array<{ tag: string }>;
    };
    assert.ok(journal.entries.some((e) => e.tag === '0005_purge_legacy_utterance_text'));
  });
});
