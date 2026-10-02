import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Worker } from 'node:worker_threads';
import { createDemoBoard, DEMO_BOARD_ID, type Board, type BoardId } from '@voxa/core';
import {
  boardStorePath,
  createFileBoardStore,
  fileStoreDataDir,
  writeFileAtomic,
} from './file-board-store.js';

/**
 * Reads a file in a tight loop on another thread until the main thread sets
 * the stop flag, and counts reads that failed to parse. A non-atomic write
 * (truncate, then write) is visible to such a reader as a short or empty
 * file: that is how parallel test files used to fail with "Unexpected end of
 * JSON input". Posts 'reading' after its first successful read so the writer
 * only starts once the reader is running.
 */
const READER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const { readFileSync } = require('node:fs');
const stop = new Int32Array(workerData.stop);
let parsed = 0;
let torn = 0;
while (Atomics.load(stop, 0) === 0) {
  const raw = readFileSync(workerData.path, 'utf8');
  try {
    JSON.parse(raw);
    parsed += 1;
    if (parsed === 1) parentPort.postMessage('reading');
  } catch {
    torn += 1;
  }
}
parentPort.postMessage({ parsed, torn });
`;

function manyBoards(count: number): Record<string, Board> {
  const boards: Record<string, Board> = {};
  for (let i = 0; i < count; i += 1) {
    const board = createDemoBoard();
    boards[`load-${i}`] = { ...board, id: `load-${i}` as BoardId };
  }
  return boards;
}

// Captured before any test below overrides it.
const preloadDataDir = process.env.VOXA_DATA_DIR;

describe('test isolation', () => {
  it('each test process gets its own data dir from the test preload', () => {
    // `pnpm test` passes --import ./src/test-support/isolated-data-dir.ts, which
    // node --test forwards to every test-file process.
    assert.ok(preloadDataDir, 'VOXA_DATA_DIR is not set: run the suite through `pnpm test`');
    assert.ok(
      preloadDataDir.startsWith(join(tmpdir(), 'voxa-api-test-')),
      `unexpected test data dir ${preloadDataDir}`,
    );
    assert.notEqual(fileStoreDataDir(), join(process.cwd(), 'data'));
  });
});

describe('file board store', () => {
  let dataDir: string;
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env.VOXA_DATA_DIR;
    dataDir = mkdtempSync(join(tmpdir(), 'voxa-file-store-'));
    process.env.VOXA_DATA_DIR = dataDir;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.VOXA_DATA_DIR;
    else process.env.VOXA_DATA_DIR = previous;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('keeps its file under VOXA_DATA_DIR', async () => {
    assert.equal(fileStoreDataDir(), dataDir);
    assert.equal(boardStorePath(), join(dataDir, 'boards.json'));

    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    assert.deepEqual(readdirSync(dataDir), ['boards.json']);
  });

  it('reloads what it persisted', async () => {
    const demoId = DEMO_BOARD_ID as BoardId;
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    await store.appendSyncEvents([
      {
        id: 'event-1',
        type: 'board.updated',
        boardId: demoId,
        version: 7,
        actorUserId: 'user-1',
        timestamp: new Date(0).toISOString(),
      },
    ]);

    const reloaded = createFileBoardStore();
    assert.ok(await reloaded.getBoard(DEMO_BOARD_ID));
    const events = await reloaded.getRecentEvents(demoId, 0);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.version, 7);
  });

  it('writeFileAtomic: a concurrent reader never sees a partial file', async () => {
    const target = join(dataDir, 'atomic.json');
    // Two different ~1 MB documents, alternated so every write changes the file.
    const docs = [0, 1].map((n) =>
      JSON.stringify({
        n,
        rows: Array.from({ length: 20_000 }, (_, i) => ({ i, label: `row-${i}` })),
      }),
    );
    writeFileAtomic(target, docs[0] ?? '');

    const stop = new SharedArrayBuffer(4);
    const reader = new Worker(READER_SOURCE, {
      eval: true,
      workerData: { path: target, stop },
    });
    const messages: unknown[] = [];
    let onMessage: (() => void) | undefined;
    reader.on('message', (m) => {
      messages.push(m);
      onMessage?.();
    });
    const failed = new Promise<never>((_, reject) => reader.once('error', reject));
    const nextMessage = () =>
      Promise.race([
        new Promise<unknown>((resolve) => {
          if (messages.length) return resolve(messages.shift());
          onMessage = () => {
            onMessage = undefined;
            resolve(messages.shift());
          };
        }),
        failed,
      ]);

    assert.equal(await nextMessage(), 'reading');
    const writes = 40;
    for (let i = 1; i <= writes; i += 1) {
      writeFileAtomic(target, docs[i % 2] ?? '');
    }
    Atomics.store(new Int32Array(stop), 0, 1);
    const { parsed, torn } = (await nextMessage()) as { parsed: number; torn: number };
    await reader.terminate();

    assert.ok(parsed > 0, 'reader never parsed the file');
    assert.equal(torn, 0, `reader saw ${torn} partial files across ${writes} writes`);
    assert.deepEqual(readdirSync(dataDir), ['atomic.json'], 'no temp files left behind');
  });

  it('persists every mutation through the atomic writer and leaves no temp files', async () => {
    const store = createFileBoardStore({ boards: manyBoards(20), events: [] });
    for (let i = 0; i < 25; i += 1) {
      await store.appendSyncEvents([]);
    }
    assert.deepEqual(readdirSync(dataDir), ['boards.json']);
    const persisted = JSON.parse(readFileSync(boardStorePath(), 'utf8')) as {
      boards: Record<string, Board>;
    };
    assert.equal(Object.keys(persisted.boards).length, 20);
  });
});
