import { randomUUID } from 'node:crypto';
import type { SyncEvent } from '@voxa/core';
import * as localHub from './hub.js';
import * as redis from './redis-pubsub.js';

/**
 * WebSocket fan-out for board changes.
 *
 * - `local`: events reach only the clients connected to this replica. Fine for
 *   one replica; with several, a co-editor on another replica misses changes.
 * - `redis` (`REDIS_URL` set and reachable): every replica publishes its
 *   events on one channel and relays the others' to its own clients, and
 *   presence is counted across replicas.
 *
 * With `REDIS_URL` set but Redis unreachable the hub runs in local mode,
 * keeps reconnecting, and `getSyncHubStatus().warning` says so (shown by
 * `/health/ready`); it switches back to Redis by itself.
 */
export type SyncHubMode = 'local' | 'redis';

export interface SyncHubStatus {
  mode: SyncHubMode;
  /** REDIS_URL was set at startup. */
  redisConfigured: boolean;
  /** Present when the hub is not doing what its configuration asks for. */
  warning?: string;
}

/** Presence entries live this long without a refresh (crashed replicas age out). */
export const PRESENCE_TTL_MS = 30_000;
const PRESENCE_REFRESH_MS = 10_000;

let redisConfigured = false;
let presenceTimer: NodeJS.Timeout | null = null;
const clientIds = new WeakMap<localHub.WsClient, string>();
const localClients = new Set<localHub.WsClient>();

function redisActive(): boolean {
  return redisConfigured && redis.isRedisConnected();
}

export function getSyncHubMode(): SyncHubMode {
  return redisActive() ? 'redis' : 'local';
}

export function getSyncHubStatus(): SyncHubStatus {
  const mode = getSyncHubMode();
  if (redisConfigured && mode !== 'redis') {
    return {
      mode,
      redisConfigured,
      warning:
        'REDIS_URL is set but Redis is unreachable: board changes and presence reach only clients on this replica until it reconnects',
    };
  }
  return { mode, redisConfigured };
}

function presenceMember(client: localHub.WsClient): string {
  let id = clientIds.get(client);
  if (!id) {
    id = randomUUID();
    clientIds.set(client, id);
  }
  return `${redis.instanceId}:${id}`;
}

/** Re-announces every local client, so their entries outlive PRESENCE_TTL_MS. */
async function refreshAllPresence(): Promise<void> {
  if (!redisActive()) return;
  const byBoard = new Map<string, string[]>();
  for (const client of localClients) {
    if (!client.boardId) continue;
    const members = byBoard.get(client.boardId) ?? [];
    members.push(presenceMember(client));
    byBoard.set(client.boardId, members);
  }
  const expiresAt = Date.now() + PRESENCE_TTL_MS;
  await Promise.all(
    [...byBoard].map(([boardId, members]) =>
      redis.refreshPresence(boardId, members, expiresAt).catch(() => undefined),
    ),
  );
}

export async function initSyncHub(): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    redisConfigured = false;
    return;
  }

  redisConfigured = true;
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
  const connected = await redis.connectRedis(redisUrl);
  if (!connected) {
    console.warn(
      '[voxa] REDIS_URL is set but Redis is unreachable: starting the sync hub in local mode (this replica only); it keeps reconnecting',
    );
  }
  presenceTimer = setInterval(() => void refreshAllPresence(), PRESENCE_REFRESH_MS);
  presenceTimer.unref();
}

export async function shutdownSyncHub(): Promise<void> {
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = null;
  if (redisConfigured) {
    await Promise.all(
      [...localClients].map((client) =>
        client.boardId
          ? redis.removePresence(client.boardId, presenceMember(client)).catch(() => undefined)
          : undefined,
      ),
    );
    await redis.disconnectRedis();
  }
  redisConfigured = false;
}

/**
 * Registers a connected, authorized client. Resolves once its presence is
 * recorded (immediately in local mode).
 */
export async function registerClient(client: localHub.WsClient): Promise<void> {
  localHub.registerClient(client);
  localClients.add(client);
  if (redisActive() && client.boardId) {
    await redis
      .refreshPresence(client.boardId, [presenceMember(client)], Date.now() + PRESENCE_TTL_MS)
      .catch(() => undefined);
  }
}

export function unregisterClient(client: localHub.WsClient): void {
  localHub.unregisterClient(client);
  localClients.delete(client);
  if (redisActive() && client.boardId) {
    void redis.removePresence(client.boardId, presenceMember(client)).catch(() => undefined);
  }
}

export function subscribeClient(client: localHub.WsClient, boardId: string): void {
  localHub.subscribeClient(client, boardId);
}

export function broadcastBoardEvent(event: SyncEvent): void {
  localHub.broadcastBoardEvent(event);

  if (!redisActive()) return;

  void redis
    .publishSyncMessage(
      JSON.stringify({
        originInstanceId: redis.instanceId,
        event,
      }),
    )
    .catch(() => undefined);
}

/**
 * People connected to `boardId`: across every replica in Redis mode, else on
 * this replica only.
 */
export async function presenceCount(boardId: string): Promise<number> {
  if (redisActive()) {
    const global = await redis.countPresence(boardId, Date.now()).catch(() => null);
    if (global !== null) return global;
  }
  return localHub.presenceCount(boardId);
}
