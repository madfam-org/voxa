import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  closeSharedDb,
  DEFAULT_POOL_MAX,
  dbClientsCreatedForTests,
  getSharedDb,
  poolMaxFromEnv,
} from './client.js';

// postgres-js connects lazily, so no database is needed for these checks.
const URL_A = 'postgres://voxa:test@127.0.0.1:1/voxa_a';
const URL_B = 'postgres://voxa:test@127.0.0.1:1/voxa_b';

describe('shared database client', () => {
  afterEach(async () => {
    await closeSharedDb();
  });

  it('opens one pool and reuses it for every caller', () => {
    const before = dbClientsCreatedForTests();
    const first = getSharedDb(URL_A);
    for (let i = 0; i < 50; i += 1) {
      assert.equal(getSharedDb(URL_A), first);
    }
    // Callers pass process.env.DATABASE_URL untrimmed; the store trims it.
    assert.equal(getSharedDb(`  ${URL_A}\n`), first);
    assert.equal(dbClientsCreatedForTests() - before, 1);
  });

  it('refuses a different database URL instead of opening a second pool', () => {
    getSharedDb(URL_A);
    const before = dbClientsCreatedForTests();
    assert.throws(() => getSharedDb(URL_B), /different database URL/);
    assert.equal(dbClientsCreatedForTests(), before);
  });

  it('closes the pool and creates a fresh one only after closeSharedDb', async () => {
    const first = getSharedDb(URL_A);
    await closeSharedDb();
    await closeSharedDb(); // idempotent
    const before = dbClientsCreatedForTests();
    const second = getSharedDb(URL_A);
    assert.notEqual(second, first);
    assert.equal(dbClientsCreatedForTests() - before, 1);
  });
});

describe('poolMaxFromEnv', () => {
  it('defaults to a small pool', () => {
    assert.equal(poolMaxFromEnv(undefined), DEFAULT_POOL_MAX);
    assert.equal(poolMaxFromEnv(''), DEFAULT_POOL_MAX);
    assert.equal(DEFAULT_POOL_MAX, 5);
  });

  it('accepts a positive integer override', () => {
    assert.equal(poolMaxFromEnv('3'), 3);
  });

  it('rejects invalid values', () => {
    for (const raw of ['0', '-1', '2.5', 'ten']) {
      assert.throws(() => poolMaxFromEnv(raw), /DATABASE_POOL_MAX/);
    }
  });
});
