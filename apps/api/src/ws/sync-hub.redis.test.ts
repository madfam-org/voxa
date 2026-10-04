import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { spawnApi, waitReady, type ApiProcess } from '../test-support/api-process.js';
import { connectTestWs, type TestWsClient } from '../test-support/ws-client.js';

/**
 * Co-editing across replicas (A-017 / C-024): two API processes on one
 * PostgreSQL and one Redis, like two production pods. A board change written
 * through replica A reaches a WebSocket client connected to replica B, and
 * presence counts clients on both.
 *
 * Runs when VOXA_TEST_REDIS_URL and VOXA_TEST_DATABASE_URL are set (throwaway
 * services: it migrates and writes there); skips itself otherwise.
 */
const redisUrl = process.env.VOXA_TEST_REDIS_URL?.trim();
const databaseUrl = process.env.VOXA_TEST_DATABASE_URL?.trim();
const skip =
  redisUrl && databaseUrl
    ? false
    : 'VOXA_TEST_REDIS_URL and VOXA_TEST_DATABASE_URL are not both set';

const OWNER = `owner-${randomUUID()}`;
const BOARD_ID = `xreplica-${randomUUID()}`;
const ownerHeaders = { 'X-Voxa-User-Id': OWNER, 'X-Voxa-Role': 'communicator' };

function replicaEnv(): Record<string, string | undefined> {
  return {
    NODE_ENV: 'test',
    VOXA_DEV_AUTH: 'true',
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    DATABASE_POOL_MAX: '2',
  };
}

function wsUrl(api: ApiProcess): string {
  // teamAuth reads the development headers; the socket handler reads the
  // development identity from the query (src/lib/ws-auth.ts).
  const query = new URLSearchParams({ boardId: BOARD_ID, userId: OWNER, role: 'communicator' });
  return `${api.url.replace('http://', 'ws://')}/v1/ws?${query}`;
}

describe('sync hub across two replicas with Redis', { skip }, () => {
  let replicaA: ApiProcess;
  let replicaB: ApiProcess;
  const sockets: TestWsClient[] = [];

  before(async () => {
    replicaA = await spawnApi(replicaEnv());
    replicaB = await spawnApi(replicaEnv());
    await Promise.all([waitReady(replicaA), waitReady(replicaB)]);
  });

  after(async () => {
    for (const socket of sockets) socket.close();
    await Promise.all([replicaA?.stop(), replicaB?.stop()]);
  });

  it('both replicas report syncHub=redis with no warning', async () => {
    for (const replica of [replicaA, replicaB]) {
      const body = (await (await fetch(`${replica.url}/health/ready`)).json()) as {
        syncHub: string;
        syncHubWarning?: string;
      };
      assert.equal(body.syncHub, 'redis');
      assert.equal(body.syncHubWarning, undefined);
    }
  });

  it('a write on replica A reaches a client on replica B; presence is global', async () => {
    const created = await fetch(`${replicaA.url}/v1/boards`, {
      method: 'POST',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: BOARD_ID,
        name: 'Cross-replica board',
        profileId: 'default',
        version: 1,
        updatedAt: new Date().toISOString(),
        grid: { rows: 1, columns: 1, buttons: [] },
      }),
    });
    assert.equal(created.status, 201, await created.clone().text());
    const { board } = (await created.json()) as {
      board: Record<string, unknown> & { version: number };
    };

    const onB = await connectTestWs(wsUrl(replicaB), ownerHeaders);
    sockets.push(onB);
    const firstConnected = (await onB.waitFor(
      (m) => (m as { type?: string }).type === 'connected',
    )) as { presence: number };
    assert.equal(firstConnected.presence, 1);

    const onA = await connectTestWs(wsUrl(replicaA), ownerHeaders);
    sockets.push(onA);
    const secondConnected = (await onA.waitFor(
      (m) => (m as { type?: string }).type === 'connected',
    )) as { presence: number };
    // One client on B plus this one on A.
    assert.equal(secondConnected.presence, 2);

    const put = await fetch(`${replicaA.url}/v1/boards/${BOARD_ID}`, {
      method: 'PUT',
      headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...board, name: 'Renamed on A', expectedVersion: board.version }),
    });
    assert.equal(put.status, 200, await put.clone().text());

    const relayed = (await onB.waitFor(
      (m) => (m as { type?: string; event?: { type?: string } }).event?.type === 'board.updated',
    )) as { type: string; event: { boardId: string; version: number } };
    assert.equal(relayed.type, 'sync');
    assert.equal(relayed.event.boardId, BOARD_ID);
    assert.equal(relayed.event.version, board.version + 1);
  });
});
