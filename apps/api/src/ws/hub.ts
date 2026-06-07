import type { SyncEvent } from '@voxa/core';

type WsClient = { send: (data: string) => void; boardId?: string };

const clients = new Set<WsClient>();

export function registerClient(client: WsClient): void {
  clients.add(client);
}

export function unregisterClient(client: WsClient): void {
  clients.delete(client);
}

export function subscribeClient(client: WsClient, boardId: string): void {
  client.boardId = boardId;
}

export function broadcastBoardEvent(event: SyncEvent): void {
  const payload = JSON.stringify({ type: 'sync', event });
  for (const client of clients) {
    if (client.boardId === (event.boardId as string)) {
      client.send(payload);
    }
  }
}

export function presenceCount(boardId: string): number {
  let count = 0;
  for (const client of clients) {
    if (client.boardId === boardId) count += 1;
  }
  return count;
}
