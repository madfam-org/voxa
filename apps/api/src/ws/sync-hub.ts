import type { SyncEvent } from '@voxa/core';
import * as localHub from './hub.js';
import * as redis from './redis-pubsub.js';

export type SyncHubMode = 'local' | 'redis';

let mode: SyncHubMode = 'local';

export function getSyncHubMode(): SyncHubMode {
  return mode;
}

export async function initSyncHub(): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    mode = 'local';
    return;
  }

  await redis.connectRedis(redisUrl);
  redis.onRedisMessage((payload) => {
    try {
      const parsed = JSON.parse(payload) as { originInstanceId?: string; event?: SyncEvent };
      if (!parsed.event) return;
      if (parsed.originInstanceId === redis.instanceId) return;
      localHub.broadcastBoardEvent(parsed.event);
    } catch {
      // Ignore malformed pub/sub payloads.
    }
  });
  mode = 'redis';
}

export async function shutdownSyncHub(): Promise<void> {
  if (mode === 'redis') {
    await redis.disconnectRedis();
  }
  mode = 'local';
}

export function registerClient(client: localHub.WsClient): void {
  localHub.registerClient(client);
}

export function unregisterClient(client: localHub.WsClient): void {
  localHub.unregisterClient(client);
}

export function subscribeClient(client: localHub.WsClient, boardId: string): void {
  localHub.subscribeClient(client, boardId);
}

export function broadcastBoardEvent(event: SyncEvent): void {
  localHub.broadcastBoardEvent(event);

  if (mode !== 'redis' || !redis.isRedisConnected()) return;

  void redis.publishSyncMessage(
    JSON.stringify({
      originInstanceId: redis.instanceId,
      event,
    }),
  );
}

export function presenceCount(boardId: string): number {
  return localHub.presenceCount(boardId);
}
