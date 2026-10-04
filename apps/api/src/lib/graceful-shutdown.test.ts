import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, it } from 'node:test';
import app from '../app.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';
import {
  closeSockets,
  createShutdown,
  DEFAULT_SHUTDOWN_DEADLINE_MS,
  isShuttingDown,
  markShuttingDown,
  resetShuttingDownForTests,
  shutdownDeadlineFromEnv,
  type ClosableServer,
  type ShutdownSteps,
} from './graceful-shutdown.js';

/** A server whose close() completes only when the test says so. */
function fakeServer(events: string[]) {
  let finish: ((err?: Error) => void) | null = null;
  const server: ClosableServer & { finish(err?: Error): void; closeCalls: number } = {
    closeCalls: 0,
    close(callback) {
      server.closeCalls += 1;
      events.push('server.close');
      finish = (err) => callback?.(err);
    },
    closeIdleConnections() {
      events.push('server.closeIdleConnections');
    },
    finish(err) {
      assert.ok(finish, 'server.close() was not called');
      finish(err);
    },
  };
  return server;
}

function steps(events: string[], overrides: Partial<ShutdownSteps> = {}) {
  const exits: number[] = [];
  const server = fakeServer(events);
  const shutdownSteps: ShutdownSteps = {
    server,
    markNotReady: () => events.push('markNotReady'),
    stopBackground: () => {
      events.push('stopBackground');
    },
    closeWebSockets: async () => {
      events.push('closeWebSockets');
    },
    closeResources: [
      { name: 'sync hub', close: async () => void events.push('close sync hub') },
      { name: 'database client', close: async () => void events.push('close database client') },
    ],
    deadlineMs: 5_000,
    exit: (code) => {
      events.push(`exit ${code}`);
      exits.push(code);
    },
    log: () => undefined,
    logError: () => undefined,
    ...overrides,
  };
  return { server, exits, shutdownSteps };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('createShutdown (A-029)', () => {
  it('marks not ready first, waits for the server to drain, then closes resources and exits 0', async () => {
    const events: string[] = [];
    const { server, exits, shutdownSteps } = steps(events);
    const done = createShutdown(shutdownSteps)('SIGTERM');
    await tick();

    // Draining: nothing after server.close() runs until it calls back.
    assert.deepEqual(events, [
      'markNotReady',
      'stopBackground',
      'closeWebSockets',
      'server.close',
      'server.closeIdleConnections',
    ]);
    assert.deepEqual(exits, []);

    server.finish();
    await done;
    assert.deepEqual(events.slice(5), ['close sync hub', 'close database client', 'exit 0']);
    assert.deepEqual(exits, [0]);
  });

  it('a second signal during the drain exits 1 at once', async () => {
    const events: string[] = [];
    const { server, exits, shutdownSteps } = steps(events);
    const shutdown = createShutdown(shutdownSteps);
    const first = shutdown('SIGTERM');
    await tick();
    await shutdown('SIGINT');
    assert.deepEqual(exits, [1]);
    assert.equal(server.closeCalls, 1);

    // The first shutdown finishing later does not exit a second time.
    server.finish();
    await first;
    assert.deepEqual(exits, [1]);
  });

  it('exits 1 when the drain outlives the deadline', async () => {
    const events: string[] = [];
    const { exits, shutdownSteps } = steps(events, { deadlineMs: 30 });
    void createShutdown(shutdownSteps)('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.deepEqual(exits, [1]);
    assert.ok(!events.includes('close database client'), 'resources are not closed under a hung server');
  });

  it('exits 1 when the server fails to close, after still closing resources', async () => {
    const events: string[] = [];
    const { server, exits, shutdownSteps } = steps(events);
    const done = createShutdown(shutdownSteps)('SIGTERM');
    await tick();
    server.finish(new Error('boom'));
    await done;
    assert.deepEqual(exits, [1]);
    assert.ok(events.includes('close database client'));
  });

  it('treats an already-closed server as drained', async () => {
    const events: string[] = [];
    const { server, exits, shutdownSteps } = steps(events);
    const done = createShutdown(shutdownSteps)('SIGTERM');
    await tick();
    server.finish(Object.assign(new Error('not running'), { code: 'ERR_SERVER_NOT_RUNNING' }));
    await done;
    assert.deepEqual(exits, [0]);
  });

  it('keeps going when a resource fails to close, and still exits 0', async () => {
    const events: string[] = [];
    const errors: string[] = [];
    const { server, exits, shutdownSteps } = steps(events, {
      closeResources: [
        { name: 'sync hub', close: async () => Promise.reject(new Error('redis gone')) },
        { name: 'database client', close: async () => void events.push('close database client') },
      ],
      logError: (message) => errors.push(message),
    });
    const done = createShutdown(shutdownSteps)('SIGTERM');
    await tick();
    server.finish();
    await done;
    assert.deepEqual(exits, [0]);
    assert.ok(events.includes('close database client'));
    assert.deepEqual(errors, ['[voxa] failed to close the sync hub on shutdown']);
  });
});

/** A socket that answers the close frame after `answerAfterMs`, or never. */
class FakeSocket extends EventEmitter {
  readonly CLOSED = 3;
  readyState = 1;
  closedWith: { code: number; reason: string } | null = null;
  terminated = false;

  constructor(private readonly answerAfterMs: number | null) {
    super();
  }

  close(code: number, reason: string) {
    this.closedWith = { code, reason };
    if (this.answerAfterMs !== null) setTimeout(() => this.finish(), this.answerAfterMs);
  }

  terminate() {
    this.terminated = true;
    this.finish();
  }

  private finish() {
    if (this.readyState === this.CLOSED) return;
    this.readyState = this.CLOSED;
    this.emit('close');
  }
}

describe('closeSockets', () => {
  it('sends 1001 to every open socket and resolves once all are closed', async () => {
    const open = [new FakeSocket(5), new FakeSocket(10)];
    const closed = new FakeSocket(0);
    closed.readyState = closed.CLOSED;
    await closeSockets([...open, closed], 'Server shutting down', 1_000);
    for (const socket of open) {
      assert.deepEqual(socket.closedWith, { code: 1001, reason: 'Server shutting down' });
      assert.equal(socket.terminated, false);
    }
    assert.equal(closed.closedWith, null);
  });

  it('drops a socket that never answers the close frame after the grace period', async () => {
    const stuck = new FakeSocket(null);
    const started = Date.now();
    await closeSockets([stuck], 'bye', 40);
    assert.equal(stuck.terminated, true);
    assert.ok(Date.now() - started >= 35);
  });

  it('resolves at once with no sockets', async () => {
    await closeSockets([], 'bye');
  });
});

describe('shutdownDeadlineFromEnv', () => {
  it('reads a positive integer and falls back to the default otherwise', () => {
    assert.equal(DEFAULT_SHUTDOWN_DEADLINE_MS, 20_000);
    assert.equal(shutdownDeadlineFromEnv({ SHUTDOWN_DEADLINE_MS: '15000' }), 15_000);
    for (const raw of [undefined, '', ' ', '0', '-5', '1.5', 'soon']) {
      assert.equal(shutdownDeadlineFromEnv({ SHUTDOWN_DEADLINE_MS: raw }), 20_000, String(raw));
    }
  });

  it('stays below the pods\' grace period minus preStop (30 s - 5 s)', () => {
    assert.ok(DEFAULT_SHUTDOWN_DEADLINE_MS < 25_000);
  });
});

describe('GET /health/ready while shutting down', () => {
  beforeEach(() => {
    useTestStore(createFileBoardStore());
    resetShuttingDownForTests();
  });
  afterEach(() => resetShuttingDownForTests());

  it('answers 503 once shutdown starts; liveness stays 200', async () => {
    assert.equal((await app.request('/health/ready')).status, 200);
    markShuttingDown();
    assert.equal(isShuttingDown(), true);
    const res = await app.request('/health/ready');
    assert.equal(res.status, 503);
    const body = (await res.json()) as { status: string; reason: string };
    assert.equal(body.status, 'unavailable');
    assert.equal(body.reason, 'Shutting down');
    assert.equal((await app.request('/health')).status, 200);
  });
});
