import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { BoardId, SyncEvent } from '@voxa/core';
import * as localHub from './hub.js';
import {
  broadcastBoardEvent,
  getSyncHubMode,
  initSyncHub,
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
});
