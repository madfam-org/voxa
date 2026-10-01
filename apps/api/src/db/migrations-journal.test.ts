import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { migrationsFolder } from './client.js';

/**
 * The drizzle migrator only runs the SQL files listed in meta/_journal.json,
 * and `drizzle-kit generate` diffs the schema against the newest snapshot in
 * meta/. A .sql file missing from the journal is silently never applied, and
 * a journal entry without a snapshot makes the next `generate` re-emit the
 * whole schema. These checks fail CI on either drift.
 */

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

const folder = migrationsFolder();
const metaFolder = join(folder, 'meta');
const journal = JSON.parse(readFileSync(join(metaFolder, '_journal.json'), 'utf8')) as {
  dialect: string;
  entries: JournalEntry[];
};
const sqlTags = readdirSync(folder)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => name.slice(0, -'.sql'.length))
  .sort();
const journalTags = journal.entries.map((entry) => entry.tag);

describe('drizzle migrations journal', () => {
  it('lists every .sql migration file', () => {
    const missing = sqlTags.filter((tag) => !journalTags.includes(tag));
    assert.deepEqual(
      missing,
      [],
      `migration files not in meta/_journal.json (the migrator would never run them): ${missing.join(', ')}`,
    );
  });

  it('has a .sql file for every entry', () => {
    const orphaned = journalTags.filter((tag) => !sqlTags.includes(tag));
    assert.deepEqual(orphaned, [], `journal entries without a .sql file: ${orphaned.join(', ')}`);
  });

  it('keeps idx sequential and in file order', () => {
    journal.entries.forEach((entry, position) => {
      assert.equal(entry.idx, position, `entry ${entry.tag} has idx ${entry.idx}, expected ${position}`);
      assert.ok(
        entry.tag.startsWith(String(position).padStart(4, '0') + '_'),
        `entry ${entry.tag} at idx ${position} does not carry the matching numeric prefix`,
      );
      assert.equal(entry.breakpoints, true, `entry ${entry.tag} must use statement breakpoints`);
    });
    assert.deepEqual(journalTags, [...sqlTags], 'journal order must match migration file order');
  });

  it('keeps "when" strictly increasing (the migrator skips entries not newer than the last applied one)', () => {
    for (let i = 1; i < journal.entries.length; i += 1) {
      const previous = journal.entries[i - 1]!;
      const current = journal.entries[i]!;
      assert.ok(
        current.when > previous.when,
        `${current.tag} "when" (${current.when}) must be greater than ${previous.tag} (${previous.when})`,
      );
    }
  });

  it('has a snapshot for every entry, so drizzle-kit generate diffs against the real schema', () => {
    const missing = journal.entries
      .map((entry) => `${String(entry.idx).padStart(4, '0')}_snapshot.json`)
      .filter((name) => !existsSync(join(metaFolder, name)));
    assert.deepEqual(missing, [], `missing snapshots in meta/: ${missing.join(', ')}`);
  });
});
