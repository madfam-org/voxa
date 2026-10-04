import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, describe, it } from 'node:test';
import app from '../app.js';
import { closeSharedDb, setQueryObserverForTests } from '../db/client.js';
import { getStore, initStore } from './index.js';
import { MAX_SYNC_EVENTS_PER_BATCH } from './board-operations.js';
import { createOwnedBoard, devHeaders } from '../test-support/boards.js';

/**
 * Board store on a real PostgreSQL (A-017, A-018). Runs when
 * VOXA_TEST_DATABASE_URL is set (a throwaway database: it migrates and writes
 * there) and skips itself otherwise. Ids are unique per run because the
 * database is shared with the other PostgreSQL test files.
 */
const testDatabaseUrl = process.env.VOXA_TEST_DATABASE_URL?.trim();
const skip = testDatabaseUrl ? false : 'VOXA_TEST_DATABASE_URL is not set';

const RUN = randomUUID().slice(0, 8);
const id = (name: string) => `${name}-${RUN}`;

type BoardBody = Record<string, unknown> & { version: number; name: string };

async function readBoard(boardId: string, userId: string): Promise<BoardBody> {
  const res = await app.request(`/v1/boards/${boardId}`, { headers: devHeaders(userId) });
  assert.equal(res.status, 200);
  return (await res.json()) as BoardBody;
}

function put(boardId: string, userId: string, body: Record<string, unknown>) {
  return app.request(`/v1/boards/${boardId}`, {
    method: 'PUT',
    headers: { ...devHeaders(userId), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * A board's content fields. Timestamps come back in PostgreSQL's text form and
 * an absent org as `undefined`, both unrelated to what this file checks.
 */
function content(board: Record<string, unknown> | undefined) {
  const { id: boardId, name, profileId, grid, layout, display, version, ownerUserId } = board ?? {};
  return { id: boardId, name, profileId, grid, layout, display, version, ownerUserId };
}

/** SQL text of the queries run while `fn` runs (never their parameters). */
async function captureQueries(fn: () => Promise<unknown>): Promise<string[]> {
  const seen: string[] = [];
  setQueryObserverForTests((sql) => seen.push(sql));
  try {
    await fn();
  } finally {
    setQueryObserverForTests(null);
  }
  return seen;
}

/** A select that reads the boards table with no WHERE clause at all. */
function isFullBoardsScan(sql: string): boolean {
  return /\bfrom "boards"/i.test(sql) && !/\bwhere\b/i.test(sql);
}

describe('PostgreSQL board store', { skip }, () => {
  before(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    assert.equal(await initStore(), 'postgres');
  });

  after(async () => {
    await closeSharedDb();
    delete process.env.DATABASE_URL;
  });

  afterEach(() => setQueryObserverForTests(null));

  it('two concurrent PUTs on the same version: exactly one 200 and one 409 with the current version', async () => {
    const owner = id('owner-race');
    const boardId = await createOwnedBoard(app, owner, id('race'));

    for (let round = 0; round < 10; round += 1) {
      const current = await readBoard(boardId, owner);
      const [a, b] = await Promise.all([
        put(boardId, owner, { ...current, name: `A${round}`, expectedVersion: current.version }),
        put(boardId, owner, { ...current, name: `B${round}`, expectedVersion: current.version }),
      ]);
      const statuses = [a.status, b.status].sort();
      assert.deepEqual(statuses, [200, 409], `round ${round}`);
      const loser = (await (a.status === 409 ? a : b).json()) as {
        code: string;
        currentVersion: number;
      };
      assert.equal(loser.code, 'VERSION_CONFLICT');
      assert.equal(loser.currentVersion, current.version + 1);
      const after = await readBoard(boardId, owner);
      assert.equal(after.version, current.version + 1);
      // The stored name is the winner's, never a silent mix.
      const winner = (await (a.status === 200 ? a : b).json()) as { board: BoardBody };
      assert.equal(after.name, winner.board.name);
    }
  });

  it('PUTs without expectedVersion still both apply (retry on a lost race)', async () => {
    const owner = id('owner-unversioned');
    const boardId = await createOwnedBoard(app, owner, id('unversioned'));
    const current = await readBoard(boardId, owner);
    const { expectedVersion: _none, ...body } = { ...current, expectedVersion: undefined };
    const [a, b] = await Promise.all([
      put(boardId, owner, { ...body, name: 'one' }),
      put(boardId, owner, { ...body, name: 'two' }),
    ]);
    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.equal((await readBoard(boardId, owner)).version, current.version + 2);
  });

  it('motor-planning 422 is unchanged', async () => {
    const owner = id('owner-motor');
    const boardId = id('motor');
    const res = await app.request('/v1/boards', {
      method: 'POST',
      headers: { ...devHeaders(owner), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: boardId,
        name: 'Motor',
        profileId: 'default',
        version: 1,
        updatedAt: new Date().toISOString(),
        grid: {
          rows: 1,
          columns: 2,
          buttons: [
            {
              id: 'yes',
              label: 'yes',
              speechText: 'yes',
              locked: true,
              position: { row: 0, column: 0 },
            },
          ],
        },
      }),
    });
    assert.equal(res.status, 201, await res.clone().text());
    const current = await readBoard(boardId, owner);
    const moved = {
      ...current,
      grid: {
        rows: 1,
        columns: 2,
        buttons: [
          {
            id: 'yes',
            label: 'yes',
            speechText: 'yes',
            locked: true,
            position: { row: 0, column: 1 },
          },
        ],
      },
      expectedVersion: current.version,
    };
    const refused = await put(boardId, owner, moved);
    assert.equal(refused.status, 422);
    assert.equal(((await refused.json()) as { code: string }).code, 'MOTOR_PLANNING_VIOLATION');
    assert.equal((await put(boardId, owner, { ...moved, forceMotorPlanning: true })).status, 200);
  });

  it('listing and the plan limit run scoped SQL, never a full boards scan', async () => {
    // Boards of other people the list must not load.
    for (let i = 0; i < 5; i += 1)
      await createOwnedBoard(app, id(`stranger-${i}`), id(`stranger-board-${i}`));
    const owner = id('owner-list');
    const mine = await createOwnedBoard(app, owner, id('mine'));

    const listQueries = await captureQueries(async () => {
      const res = await app.request('/v1/boards', { headers: devHeaders(owner) });
      assert.equal(res.status, 200);
      const { boards } = (await res.json()) as { boards: { id: string }[] };
      assert.deepEqual(boards.map((b) => b.id).sort(), ['demo-core', mine].sort());
    });
    assert.ok(listQueries.length > 0);
    assert.deepEqual(listQueries.filter(isFullBoardsScan), []);
    assert.ok(
      listQueries.some((q) => /"owner_user_id" = \$/.test(q)),
      listQueries.join('\n'),
    );

    // The free plan allows one board: the second create is refused by a count.
    const limitQueries = await captureQueries(async () => {
      const res = await app.request('/v1/boards', {
        method: 'POST',
        headers: { ...devHeaders(owner), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id('second'),
          name: 'Second',
          profileId: 'default',
          version: 1,
          updatedAt: new Date().toISOString(),
          grid: { rows: 1, columns: 1, buttons: [] },
        }),
      });
      assert.equal(res.status, 402);
    });
    assert.deepEqual(limitQueries.filter(isFullBoardsScan), []);
    assert.ok(
      limitQueries.some((q) => /count\(\*\)/i.test(q)),
      limitQueries.join('\n'),
    );
  });

  it('writes never load the whole boards table, and trim events in one statement', async () => {
    const owner = id('owner-write');
    const boardId = await createOwnedBoard(app, owner, id('write'));
    const current = await readBoard(boardId, owner);
    const writeQueries = await captureQueries(async () => {
      const res = await put(boardId, owner, {
        ...current,
        name: 'renamed',
        expectedVersion: current.version,
      });
      assert.equal(res.status, 200);
    });
    assert.deepEqual(writeQueries.filter(isFullBoardsScan), []);
    const trims = writeQueries.filter((q) => /^delete from "sync_events"/i.test(q));
    assert.equal(trims.length, 1);
    assert.match(trims[0] ?? '', /"board_id" = \$\d+ and "sync_events"\."id" in \(select/i);
  });

  it('an editor lists their organization boards; another organization stays out', async () => {
    const orgA = id('org-a');
    const owner = id('owner-org');
    const res = await app.request('/v1/boards', {
      method: 'POST',
      headers: { ...devHeaders(owner), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id('org-board'),
        name: 'Org board',
        profileId: 'default',
        version: 1,
        updatedAt: new Date().toISOString(),
        grid: { rows: 1, columns: 1, buttons: [] },
      }),
    });
    assert.equal(res.status, 201);
    // Dev headers carry no org id, so place the board in orgA directly.
    const store = getStore();
    const listed = await store.listBoardsForActor({
      userId: id('editor'),
      role: 'editor',
      orgId: orgA,
    });
    assert.ok(!listed.some((b) => b.id === id('org-board')));
    const { getSharedDb } = await import('../db/client.js');
    const { client } = getSharedDb(testDatabaseUrl!);
    await client`update boards set org_id = ${orgA} where id = ${id('org-board')}`;
    const editorView = await store.listBoardsForActor({
      userId: id('editor'),
      role: 'editor',
      orgId: orgA,
    });
    assert.ok(editorView.some((b) => b.id === id('org-board')));
    const otherOrg = await store.listBoardsForActor({
      userId: id('editor'),
      role: 'editor',
      orgId: id('org-b'),
    });
    assert.ok(!otherOrg.some((b) => b.id === id('org-board')));
    const communicator = await store.listBoardsForActor({
      userId: id('member'),
      role: 'communicator',
      orgId: orgA,
    });
    assert.ok(!communicator.some((b) => b.id === id('org-board')));
  });

  it('layout and display survive create, read, update and list unchanged', async () => {
    const owner = id('owner-layout');
    const boardId = id('layout');
    const original = {
      id: boardId,
      name: 'Keyboard',
      profileId: 'default',
      version: 1,
      updatedAt: new Date().toISOString(),
      layout: 'literacy-keyboard',
      display: { hideSymbols: true, hideLabels: false },
      grid: { rows: 1, columns: 1, buttons: [] },
    };
    const created = await app.request('/v1/boards', {
      method: 'POST',
      headers: { ...devHeaders(owner), 'Content-Type': 'application/json' },
      body: JSON.stringify(original),
    });
    assert.equal(created.status, 201, await created.clone().text());
    const createdBoard = ((await created.json()) as { board: BoardBody }).board;

    // Read back through the store and the API: identical to what was saved.
    const stored = await getStore().getBoard(boardId);
    assert.deepEqual(content(stored as never), content(createdBoard));
    const read = await readBoard(boardId, owner);
    assert.equal(read.layout, 'literacy-keyboard');
    assert.deepEqual(read.display, { hideSymbols: true, hideLabels: false });
    assert.deepEqual(content(read), content(createdBoard));
    assert.equal(createdBoard.layout, original.layout);
    assert.deepEqual(createdBoard.display, original.display);

    // An update that changes them is stored, and a list returns them.
    const res = await put(boardId, owner, {
      ...read,
      layout: 'visual-schedule',
      display: { hideLabels: true },
      expectedVersion: read.version,
    });
    assert.equal(res.status, 200);
    const updated = ((await res.json()) as { board: BoardBody }).board;
    assert.deepEqual(content(await readBoard(boardId, owner)), content(updated));
    assert.equal(updated.layout, 'visual-schedule');
    assert.deepEqual(updated.display, { hideLabels: true });
    const listed = await getStore().listBoardsForActor({ userId: owner, role: 'communicator' });
    assert.deepEqual(content(listed.find((b) => b.id === boardId) as never), content(updated));

    // A board saved without them reads back without them (no nulls).
    const plain = await createOwnedBoard(app, id('owner-plain'), id('plain'));
    const plainBoard = await readBoard(plain, id('owner-plain'));
    assert.ok(!('layout' in plainBoard));
    assert.ok(!('display' in plainBoard));
  });

  it(`refuses a sync-event batch over ${MAX_SYNC_EVENTS_PER_BATCH} before writing`, async () => {
    const events = Array.from({ length: MAX_SYNC_EVENTS_PER_BATCH + 1 }, (_, i) => ({
      id: `${RUN}-evt-${i}`,
      type: 'board.updated' as const,
      boardId: 'demo-core' as never,
      version: i,
      actorUserId: 'x',
      timestamp: new Date().toISOString(),
    }));
    await assert.rejects(
      getStore().appendSyncEvents(events),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 413);
        return true;
      },
    );
  });
});
