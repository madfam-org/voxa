import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request, type ClientRequest, type IncomingMessage } from 'node:http';
import { afterEach, describe, it } from 'node:test';
import { spawnApi, waitReady, type ApiProcess } from './test-support/api-process.js';
import { connectTestWs } from './test-support/ws-client.js';

/**
 * Graceful shutdown of the real entry point (A-029; src/lib/graceful-shutdown.ts):
 * a request in flight when SIGTERM arrives still gets its answer, open
 * WebSockets are closed with 1001, and the process exits 0. A second signal
 * or the deadline exits 1.
 */
const OWNER = `owner-${randomUUID()}`;
const ownerHeaders = { 'X-Voxa-User-Id': OWNER, 'X-Voxa-Role': 'communicator' };

function apiEnv(extra: Record<string, string> = {}): Record<string, string | undefined> {
  return { NODE_ENV: 'test', VOXA_DEV_AUTH: 'true', ...extra };
}

function boardBody(id: string): string {
  return JSON.stringify({
    id,
    name: `Board ${id}`,
    profileId: 'default',
    version: 1,
    updatedAt: new Date().toISOString(),
    grid: { rows: 2, columns: 2, buttons: [] },
  });
}

/**
 * Starts `POST /v1/boards` and sends only the first half of the body, so the
 * request is in flight until `finish()` sends the rest. A user of its own,
 * so the plan's board limit never answers instead.
 */
function startSlowCreate(api: ApiProcess, boardId: string) {
  const body = boardBody(boardId);
  const target = new URL(`${api.url}/v1/boards`);
  let req: ClientRequest;
  const response = new Promise<{ status: number; text: string }>((resolve, reject) => {
    req = request({
      host: target.hostname,
      port: target.port,
      path: target.pathname,
      method: 'POST',
      headers: {
        'X-Voxa-User-Id': `slow-${randomUUID()}`,
        'X-Voxa-Role': 'communicator',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    });
    req.on('response', (res: IncomingMessage) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (text += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
    });
    req.on('error', reject);
  });
  const half = Math.floor(body.length / 2);
  req!.write(body.slice(0, half));
  return {
    response,
    finish: () => req.end(body.slice(half)),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function createBoard(api: ApiProcess, boardId: string): Promise<void> {
  const res = await fetch(`${api.url}/v1/boards`, {
    method: 'POST',
    headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
    body: boardBody(boardId),
  });
  assert.equal(res.status, 201, await res.text());
}

/** Opens a board WebSocket with the development identity (src/lib/ws-auth.ts). */
async function openBoardSocket(api: ApiProcess, boardId: string) {
  const query = new URLSearchParams({ boardId, userId: OWNER, role: 'communicator' });
  const socket = await connectTestWs(`${api.url.replace('http://', 'ws://')}/v1/ws?${query}`, ownerHeaders);
  await socket.waitFor((m) => (m as { type?: string }).type === 'connected');
  return socket;
}

describe('API process shutdown (A-029)', () => {
  let api: ApiProcess | null = null;

  afterEach(async () => {
    if (api && api.child.exitCode === null && api.child.signalCode === null) api.child.kill('SIGKILL');
    await api?.exited;
    api = null;
  });

  it('on SIGTERM: finishes the request in flight, closes sockets with 1001, exits 0', async () => {
    api = await spawnApi(apiEnv());
    await waitReady(api);
    const socketBoard = `ws-${randomUUID()}`;
    await createBoard(api, socketBoard);
    const socket = await openBoardSocket(api, socketBoard);

    const slow = startSlowCreate(api, `slow-${randomUUID()}`);
    await sleep(200); // the server has the headers and half the body
    api.child.kill('SIGTERM');

    const closeFrame = (await socket.waitFor(
      (m) => (m as { type?: string }).type === '__close',
    )) as { code?: number };
    assert.equal(closeFrame.code, 1001);
    socket.close(); // what a client does after the close frame

    await sleep(300);
    assert.equal(api.child.exitCode, null, `exited before the request finished:\n${api.output()}`);

    slow.finish();
    const res = await slow.response;
    assert.equal(res.status, 201, res.text);

    assert.equal(await api.exited, 0, api.output());
    assert.match(api.output(), /SIGTERM: draining/);
    assert.match(api.output(), /shutdown complete/);
  });

  it('a second signal during the drain exits 1', async () => {
    api = await spawnApi(apiEnv());
    await waitReady(api);
    const slow = startSlowCreate(api, `slow-${randomUUID()}`);
    slow.response.catch(() => undefined); // the connection is cut
    await sleep(200);
    api.child.kill('SIGTERM');
    await sleep(200);
    assert.equal(api.child.exitCode, null);
    api.child.kill('SIGINT');
    assert.equal(await api.exited, 1, api.output());
    assert.match(api.output(), /SIGINT during shutdown: exiting now/);
  });

  it('exits 1 when the drain outlives SHUTDOWN_DEADLINE_MS', async () => {
    api = await spawnApi(apiEnv({ SHUTDOWN_DEADLINE_MS: '500' }));
    await waitReady(api);
    const slow = startSlowCreate(api, `slow-${randomUUID()}`);
    slow.response.catch(() => undefined);
    await sleep(200);
    const started = Date.now();
    api.child.kill('SIGTERM');
    assert.equal(await api.exited, 1, api.output());
    assert.ok(Date.now() - started < 5_000);
    assert.match(api.output(), /did not finish within 500 ms/);
  });
});
