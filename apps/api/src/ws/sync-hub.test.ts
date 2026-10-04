import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { BoardId, SyncEvent } from '@voxa/core';
import * as localHub from './hub.js';
import {
  broadcastBoardEvent,
  getSyncHubMode,
  getSyncHubStatus,
  initSyncHub,
  presenceCount,
  registerClient,
  shutdownSyncHub,
  unregisterClient,
} from './sync-hub.js';

describe('sync hub', () => {
  afterEach(async () => {
    delete process.env.REDIS_URL;
    await shutdownSyncHub();
  });

  it('defaults to local mode without REDIS_URL', async () => {
    delete process.env.REDIS_URL;
    await initSyncHub();
    assert.equal(getSyncHubMode(), 'local');
  });

  it('broadcasts board events to subscribed local clients', async () => {
    await initSyncHub();

    const boardId = 'board-a' as BoardId;
    const messages: string[] = [];
    const client: localHub.WsClient = {
      boardId,
      send: (data) => messages.push(data),
    };
    registerClient(client);

    const event: SyncEvent = {
      id: 'evt-1',
      type: 'board.updated',
      boardId,
      version: 2,
      actorUserId: 'editor-1',
      timestamp: new Date().toISOString(),
    };
    broadcastBoardEvent(event);

    assert.equal(messages.length, 1);
    assert.match(messages[0] ?? '', /"type":"sync"/);
    unregisterClient(client);
  });

  it('an unreachable Redis degrades to local mode with a warning instead of failing startup', async () => {
    // Port 1 on loopback refuses connections at once.
    process.env.REDIS_URL = 'redis://127.0.0.1:1/0';
    const started = Date.now();
    await initSyncHub();
    assert.ok(Date.now() - started < 10_000);
    assert.equal(getSyncHubMode(), 'local');
    const status = getSyncHubStatus();
    assert.equal(status.redisConfigured, true);
    assert.match(status.warning ?? '', /Redis is unreachable/);

    // Local fan-out and local presence keep working.
    const boardId = 'board-degraded' as BoardId;
    const messages: string[] = [];
    const client: localHub.WsClient = { boardId, send: (data) => messages.push(data) };
    await registerClient(client);
    assert.equal(await presenceCount(boardId), 1);
    broadcastBoardEvent({
      id: 'evt-degraded',
      type: 'board.updated',
      boardId,
      version: 3,
      actorUserId: 'editor-1',
      timestamp: new Date().toISOString(),
    });
    assert.equal(messages.length, 1);
    unregisterClient(client);
  });

  it('without REDIS_URL there is no warning', async () => {
    delete process.env.REDIS_URL;
    await initSyncHub();
    assert.deepEqual(getSyncHubStatus(), { mode: 'local', redisConfigured: false });
  });
});
