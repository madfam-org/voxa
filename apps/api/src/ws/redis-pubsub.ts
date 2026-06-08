import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';

export const SYNC_BROADCAST_CHANNEL = 'voxa:sync:broadcast';

export const instanceId = randomUUID();

let publisher: Redis | null = null;
let subscriber: Redis | null = null;
let messageHandler: ((payload: string) => void) | null = null;

export function isRedisConnected(): boolean {
  return publisher !== null && subscriber !== null;
}

export async function connectRedis(redisUrl: string): Promise<void> {
  if (isRedisConnected()) return;

  publisher = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
  subscriber = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });

  await Promise.all([publisher.connect(), subscriber.connect()]);

  subscriber.on('message', (channel, payload) => {
    if (channel !== SYNC_BROADCAST_CHANNEL) return;
    messageHandler?.(payload);
  });

  await subscriber.subscribe(SYNC_BROADCAST_CHANNEL);
}

export function onRedisMessage(handler: (payload: string) => void): void {
  messageHandler = handler;
}

export async function publishSyncMessage(payload: string): Promise<void> {
  if (!publisher) return;
  await publisher.publish(SYNC_BROADCAST_CHANNEL, payload);
}

export async function disconnectRedis(): Promise<void> {
  const pub = publisher;
  const sub = subscriber;
  publisher = null;
  subscriber = null;
  messageHandler = null;

  await Promise.all([
    sub?.unsubscribe(SYNC_BROADCAST_CHANNEL).catch(() => undefined),
    sub?.quit().catch(() => undefined),
    pub?.quit().catch(() => undefined),
  ]);
}
