import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DrizzleQueryError } from 'drizzle-orm';
import { runMigrations } from './client.js';
import {
  DEFAULT_STARTUP_RETRY_MS,
  retryableConnectionCode,
  startupRetryBudgetFromEnv,
  withStartupConnectRetry,
} from './startup-retry.js';

function connError(code: string): Error {
  return Object.assign(new Error(`connect ${code} 10.0.0.1:5432`), { code });
}

/** Fake clock: sleep() advances now() instead of waiting. */
function fakeClock() {
  let t = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
  };
}

describe('startup database retry', () => {
  it('retries a transient connection refusal and returns the result', async () => {
    const clock = fakeClock();
    const logs: string[] = [];
    let calls = 0;
    const result = await withStartupConnectRetry(
      'migrations',
      async () => {
        calls += 1;
        if (calls < 3) throw connError('ECONNREFUSED');
        return 'migrated';
      },
      { budgetMs: 30_000, sleep: clock.sleep, now: clock.now, log: (m) => logs.push(m) },
    );
    assert.equal(result, 'migrated');
    assert.equal(calls, 3);
    assert.deepEqual(clock.sleeps, [500, 1000]);
    assert.equal(logs.length, 2);
    assert.match(logs[0] ?? '', /ECONNREFUSED/);
  });

  it('retries every connection-level code', async () => {
    for (const code of ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']) {
      const clock = fakeClock();
      let calls = 0;
      await withStartupConnectRetry(
        'migrations',
        async () => {
          calls += 1;
          if (calls === 1) throw connError(code);
        },
        { budgetMs: 30_000, sleep: clock.sleep, now: clock.now, log: () => {} },
      );
      assert.equal(calls, 2, code);
    }
  });

  it('gives up after the budget and rethrows the last error unchanged', async () => {
    const clock = fakeClock();
    let calls = 0;
    let last: Error | undefined;
    await assert.rejects(
      withStartupConnectRetry(
        'migrations',
        async () => {
          calls += 1;
          last = connError('ECONNREFUSED');
          throw last;
        },
        { budgetMs: 30_000, sleep: clock.sleep, now: clock.now, log: () => {} },
      ),
      (err) => err === last,
    );
    // 500 + 1000 + 2000 + 4000 + 5000 + 5000 + 5000 + 5000 = 27.5 s; one more 5 s wait would exceed 30 s.
    assert.deepEqual(clock.sleeps, [500, 1000, 2000, 4000, 5000, 5000, 5000, 5000]);
    assert.equal(calls, clock.sleeps.length + 1);
    assert.ok(clock.now() <= 30_000);
  });

  it('never retries SQL or migration errors', async () => {
    const clock = fakeClock();
    const sqlError = Object.assign(new Error('relation "boards" does not exist'), {
      code: '42P01',
    });
    let calls = 0;
    await assert.rejects(
      withStartupConnectRetry(
        'migrations',
        async () => {
          calls += 1;
          throw new DrizzleQueryError('CREATE TABLE boards (…)', [], sqlError);
        },
        { budgetMs: 30_000, sleep: clock.sleep, now: clock.now, log: () => {} },
      ),
      DrizzleQueryError,
    );
    assert.equal(calls, 1);
    assert.deepEqual(clock.sleeps, []);
  });

  it('does not retry when the budget is 0', async () => {
    const clock = fakeClock();
    let calls = 0;
    await assert.rejects(
      withStartupConnectRetry(
        'migrations',
        async () => {
          calls += 1;
          throw connError('ECONNREFUSED');
        },
        { budgetMs: 0, sleep: clock.sleep, now: clock.now, log: () => {} },
      ),
      /ECONNREFUSED/,
    );
    assert.equal(calls, 1);
  });

  it('finds the connection code through cause chains and AggregateError', () => {
    const wrapped = new DrizzleQueryError('select 1', [], connError('ECONNRESET'));
    assert.equal(retryableConnectionCode(wrapped), 'ECONNRESET');
    const aggregate = Object.assign(
      new AggregateError([connError('ECONNREFUSED'), connError('ECONNREFUSED')], 'connect failed'),
      {},
    );
    assert.equal(retryableConnectionCode(aggregate), 'ECONNREFUSED');
    assert.equal(retryableConnectionCode(new Error('syntax error')), undefined);
    assert.equal(
      retryableConnectionCode(Object.assign(new Error('x'), { code: '28P01' })),
      undefined,
    );
    assert.equal(retryableConnectionCode('ECONNREFUSED'), undefined);
  });

  it('reads DATABASE_STARTUP_RETRY_MS', () => {
    assert.equal(startupRetryBudgetFromEnv(undefined), DEFAULT_STARTUP_RETRY_MS);
    assert.equal(startupRetryBudgetFromEnv(''), DEFAULT_STARTUP_RETRY_MS);
    assert.equal(startupRetryBudgetFromEnv('0'), 0);
    assert.equal(startupRetryBudgetFromEnv('60000'), 60_000);
    assert.throws(() => startupRetryBudgetFromEnv('-1'), /non-negative integer/);
    assert.throws(() => startupRetryBudgetFromEnv('soon'), /non-negative integer/);
  });

  it('retries a real refused connection from runMigrations and never logs the connection string', async () => {
    // Port 1 on loopback refuses immediately; nothing listens there.
    const url = 'postgres://voxa_test_user:not-a-secret@127.0.0.1:1/voxa_retry_test';
    const logs: string[] = [];
    // Fake clock so the attempt count does not depend on machine load.
    const clock = fakeClock();
    let attempts = 0;
    await assert.rejects(
      withStartupConnectRetry(
        'migrations',
        () => {
          attempts += 1;
          return runMigrations(url);
        },
        { budgetMs: 30_000, sleep: clock.sleep, now: clock.now, log: (m) => logs.push(m) },
      ),
      (err) => retryableConnectionCode(err) === 'ECONNREFUSED',
    );
    assert.equal(attempts, 9);
    assert.equal(
      logs.length,
      9,
      `expected 8 retry lines and 1 give-up line, got ${JSON.stringify(logs)}`,
    );
    for (const line of logs) {
      assert.doesNotMatch(line, /voxa_test_user|not-a-secret|127\.0\.0\.1|voxa_retry_test/);
    }
  });
});
