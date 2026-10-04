import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { Board } from '@voxa/core';
import { createVoxaClient, VoxaSyncError } from './index.js';

const board = { id: 'b1', name: 'B', version: 3, grid: { rows: 1, columns: 1, buttons: [] } } as unknown as Board;
const realFetch = globalThis.fetch;

function captureFetch(status: number, body: unknown): { bodies: Record<string, unknown>[] } {
  const seen = { bodies: [] as Record<string, unknown>[] };
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    seen.bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return seen;
}

describe('VoxaClient.saveBoard', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sends no forceMotorPlanning flag by default', async () => {
    const seen = captureFetch(200, { board, event: {} });
    await createVoxaClient({ baseUrl: 'http://api.test', accessToken: 't' }).saveBoard(board, 3);
    assert.equal(seen.bodies[0]!.expectedVersion, 3);
    assert.equal('forceMotorPlanning' in seen.bodies[0]!, false);
  });

  it('sends forceMotorPlanning: true for an override', async () => {
    const seen = captureFetch(200, { board, event: {} });
    await createVoxaClient({ baseUrl: 'http://api.test', accessToken: 't' }).saveBoard(board, 3, {
      forceMotorPlanning: true,
    });
    assert.equal(seen.bodies[0]!.forceMotorPlanning, true);
  });

  it('surfaces a 422 as a VoxaSyncError with its status', async () => {
    captureFetch(422, { error: 'Motor planning violation', code: 'MOTOR_PLANNING_VIOLATION' });
    await assert.rejects(
      createVoxaClient({ baseUrl: 'http://api.test', accessToken: 't' }).saveBoard(board, 3),
      (err: unknown) => err instanceof VoxaSyncError && err.status === 422,
    );
  });
});
