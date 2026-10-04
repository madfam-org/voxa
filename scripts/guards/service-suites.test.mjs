import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { describe, it } from 'node:test';
import { canConnect, checkServiceSuites, isCi, serviceAddress, serviceNeeds } from '../run-unit-tests.mjs';

// A-032: a CI job without its database must fail, not pass as a clean run.
const FILES = [
  'src/app.test.ts',
  'src/routes/media.pg.test.ts',
  'src/store/pg-board-store.pg.test.ts',
  'src/ws/sync-hub.redis.test.ts',
];
const PG = 'postgres://u:p@127.0.0.1:55503/db';
const REDIS = 'redis://127.0.0.1:6303/0';
const up = async () => true;
const down = async () => false;

describe('service suites (A-032)', () => {
  it('reads CI the way GitHub Actions sets it', () => {
    assert.equal(isCi({ CI: 'true' }), true);
    assert.equal(isCi({ CI: '1' }), true);
    for (const value of [undefined, '', 'false', 'FALSE', '0']) assert.equal(isCi({ CI: value }), false, String(value));
  });

  it('counts the suites per service and the unset variables', () => {
    assert.deepEqual(serviceNeeds(FILES, {}), [
      { service: 'PostgreSQL', files: 2, vars: ['VOXA_TEST_DATABASE_URL'], missing: ['VOXA_TEST_DATABASE_URL'] },
      {
        service: 'Redis',
        files: 1,
        vars: ['VOXA_TEST_REDIS_URL', 'VOXA_TEST_DATABASE_URL'],
        missing: ['VOXA_TEST_REDIS_URL', 'VOXA_TEST_DATABASE_URL'],
      },
    ]);
    assert.deepEqual(serviceNeeds(['src/a.test.ts'], {}), []);
    assert.deepEqual(serviceNeeds(FILES, { VOXA_TEST_DATABASE_URL: '  ' })[0].missing, ['VOXA_TEST_DATABASE_URL']);
  });

  it('locally, skips with a stated reason when the variables are unset', async () => {
    const result = await checkServiceSuites(FILES, {}, up);
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.notes, [
      'skipping 2 PostgreSQL suites: VOXA_TEST_DATABASE_URL is not set (CI fails instead)',
      'skipping 1 Redis suite: VOXA_TEST_REDIS_URL and VOXA_TEST_DATABASE_URL are not set (CI fails instead)',
    ]);
  });

  it('in CI, fails when a variable is unset', async () => {
    const result = await checkServiceSuites(FILES, { CI: 'true', VOXA_TEST_DATABASE_URL: PG }, up);
    assert.deepEqual(result.problems, [
      '1 Redis suite cannot run: VOXA_TEST_REDIS_URL is not set (CI requires them; a skipped suite is not a pass)',
    ]);
    const none = await checkServiceSuites(FILES, { CI: 'true' }, up);
    assert.equal(none.problems.length, 2);
  });

  it('fails when a set service refuses connections, in CI and locally, without printing the URL', async () => {
    for (const CI of ['true', undefined]) {
      const result = await checkServiceSuites(FILES, { CI, VOXA_TEST_DATABASE_URL: PG, VOXA_TEST_REDIS_URL: REDIS }, down);
      assert.equal(result.problems.length, 3, String(CI));
      for (const problem of result.problems) {
        assert.match(problem, /refuses connections/);
        assert.ok(!problem.includes('u:p@') && !problem.includes('55503'), problem);
      }
    }
  });

  it('passes when every service answers, and probes each URL once', async () => {
    const seen = [];
    const connect = async (address) => {
      seen.push(`${address.host}:${address.port}`);
      return true;
    };
    const env = { CI: 'true', VOXA_TEST_DATABASE_URL: PG, VOXA_TEST_REDIS_URL: REDIS };
    assert.deepEqual(await checkServiceSuites(FILES, env, connect), { problems: [], notes: [] });
    assert.deepEqual(seen, ['127.0.0.1:55503', '127.0.0.1:6303']);
  });

  it('reads host and port from service URLs, with default ports', () => {
    assert.deepEqual(serviceAddress('postgres://ci:ci@127.0.0.1:5432/voxa_test'), { host: '127.0.0.1', port: 5432 });
    assert.deepEqual(serviceAddress('postgresql://db.example/x'), { host: 'db.example', port: 5432 });
    assert.deepEqual(serviceAddress('redis://[::1]/0'), { host: '::1', port: 6379 });
    assert.equal(serviceAddress('not a url'), null);
    assert.equal(serviceAddress('http://host/x'), null);
  });

  it('probes a real listener and a closed port', async () => {
    const server = createServer((socket) => socket.end());
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    assert.equal(await canConnect({ host: '127.0.0.1', port }, 2000), true);
    await new Promise((resolve) => server.close(resolve));
    assert.equal(await canConnect({ host: '127.0.0.1', port }, 2000), false);
  });
});
