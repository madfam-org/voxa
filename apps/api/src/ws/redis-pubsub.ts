import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';

export const SYNC_BROADCAST_CHANNEL = 'voxa:sync:broadcast';

/** Sorted set per board: member `<instance>:<client>`, score = expiry (ms). */
export const PRESENCE_KEY_PREFIX = 'voxa:presence:';

export const instanceId = randomUUID();

/** How long the first connection may take before the hub starts in local mode. */
const CONNECT_TIMEOUT_MS = 3_000;

let publisher: Redis | null = null;
let subscriber: Redis | null = null;
let messageHandler: ((payload: string) => void) | null = null;
let lastErrorLogged: string | null = null;

/** Both connections are up: publish, subscribe and presence work. */
export function isRedisConnected(): boolean {
  return publisher?.status === 'ready' && subscriber?.status === 'ready';
}

/** A Redis URL was given and clients exist (connected or reconnecting). */
export function isRedisConfigured(): boolean {
  return publisher !== null && subscriber !== null;
}

function logConnectionError(role: string, err: Error): void {
  // One line per distinct failure, not one per reconnect attempt.
  const code = (err as Error & { code?: string }).code ?? err.name;
  const key = `${role}:${code}`;
  if (key === lastErrorLogged) return;
  lastErrorLogged = key;
  console.warn(`[voxa] Redis ${role} connection error (${code}); sync hub falls back to this replica only`);
}

function createClient(redisUrl: string, role: string, offlineQueue: boolean): Redis {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: offlineQueue,
    // Keep reconnecting in the background, at most every 5 s.
    retryStrategy: (times) => Math.min(times * 500, 5_000),
  });
  redis.on('error', (err: Error) => logConnectionError(role, err));
  redis.on('ready', () => {
    if (lastErrorLogged) console.log(`[voxa] Redis ${role} connection ready`);
    lastErrorLogged = null;
  });
  return redis;
}

/**
 * Opens the publisher and subscriber. Resolves true once both are ready, or
 * false after CONNECT_TIMEOUT_MS: the clients keep reconnecting in the
 * background and the hub switches to Redis when they come up. Never throws,
 * so an unreachable Redis cannot keep the API from starting.
 */
export async function connectRedis(redisUrl: string): Promise<boolean> {
  if (isRedisConfigured()) return isRedisConnected();

  publisher = createClient(redisUrl, 'publisher', false);
  // The subscriber queues SUBSCRIBE until it is connected; ioredis
  // re-subscribes by itself after every reconnect.
  subscriber = createClient(redisUrl, 'subscriber', true);

  subscriber.on('message', (channel: string, payload: string) => {
    if (channel !== SYNC_BROADCAST_CHANNEL) return;
    messageHandler?.(payload);
  });

  const ready = Promise.all([
    publisher.connect(),
    subscriber.connect().then(() => subscriber?.subscribe(SYNC_BROADCAST_CHANNEL)),
  ]).then(
    () => true,
    () => false,
  );
  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), CONNECT_TIMEOUT_MS + 500).unref();
  });
  const connected = await Promise.race([ready, timeout]);
  if (!connected && subscriber) {
    // The initial connect() failed: subscribe again on the first ready.
    subscriber.once('ready', () => {
      void subscriber?.subscribe(SYNC_BROADCAST_CHANNEL).catch(() => undefined);
    });
  }
  return connected && isRedisConnected();
}

export function onRedisMessage(handler: (payload: string) => void): void {
  messageHandler = handler;
}

export async function publishSyncMessage(payload: string): Promise<void> {
  if (!publisher || publisher.status !== 'ready') return;
  await publisher.publish(SYNC_BROADCAST_CHANNEL, payload);
}

/** Adds or refreshes presence members of one board until `expiresAt` (ms). */
export async function refreshPresence(boardId: string, members: string[], expiresAt: number): Promise<void> {
  if (!publisher || publisher.status !== 'ready' || members.length === 0) return;
  const key = `${PRESENCE_KEY_PREFIX}${boardId}`;
  const args: (string | number)[] = [];
  for (const member of members) args.push(expiresAt, member);
  await publisher
    .multi()
    .zadd(key, ...args)
    .pexpireat(key, expiresAt)
    .exec();
}

export async function removePresence(boardId: string, member: string): Promise<void> {
  if (!publisher || publisher.status !== 'ready') return;
  await publisher.zrem(`${PRESENCE_KEY_PREFIX}${boardId}`, member);
}

/** Members of one board on every replica whose entry has not expired. */
export async function countPresence(boardId: string, now: number): Promise<number | null> {
  if (!publisher || publisher.status !== 'ready') return null;
  const key = `${PRESENCE_KEY_PREFIX}${boardId}`;
  const results = await publisher
    .multi()
    .zremrangebyscore(key, '-inf', now)
    .zcard(key)
    .exec();
  const card = results?.[1]?.[1];
  return typeof card === 'number' ? card : null;
}

export async function disconnectRedis(): Promise<void> {
  const pub = publisher;
  const sub = subscriber;
  publisher = null;
  subscriber = null;
  messageHandler = null;
  lastErrorLogged = null;

  const close = async (client: Redis | null) => {
    if (!client) return;
    if (client.status === 'ready') {
      await client.quit().catch(() => client.disconnect());
    } else {
      client.disconnect();
    }
  };
  if (sub?.status === 'ready') await sub.unsubscribe(SYNC_BROADCAST_CHANNEL).catch(() => undefined);
  await Promise.all([close(sub), close(pub)]);
}
