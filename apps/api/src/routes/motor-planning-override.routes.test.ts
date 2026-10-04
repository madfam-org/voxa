/**
 * The motor-plan override is enforced by the API, not only by the client:
 * `forceMotorPlanning: true` is honoured only for a `voxa:admin` of the
 * board's own organization. Real RS256 tokens (they carry `org_id`, which the
 * development headers cannot).
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createBoardId, type Board } from '@voxa/core';
import app from '../app.js';
import * as fileStore from '../store/file-board-store.js';
import * as store from '../store/index.js';
import { startTestTokenIssuer, type TestTokenIssuer } from '../test-support/janua-tokens.js';

const ORG = 'org-motor';
const BOARD_ID = 'motor-board';

let issuer: TestTokenIssuer;

function lockedBoard(): Board {
  return {
    id: createBoardId(BOARD_ID),
    name: 'Motor plan',
    profileId: 'default' as Board['profileId'],
    version: 1,
    updatedAt: new Date().toISOString(),
    ownerUserId: 'slp-owner',
    orgId: ORG,
    grid: {
      rows: 1,
      columns: 2,
      buttons: [
        {
          id: 'yes',
          label: 'yes',
          speechText: 'yes',
          locked: true,
          position: { row: 0, column: 0 },
        } as unknown as Board['grid']['buttons'][number],
      ],
    },
  };
}

/** The stored board with the locked button moved one cell. */
async function movedBody(extra: Record<string, unknown> = {}, locked?: boolean) {
  const current = (await store.getStore().getBoard(BOARD_ID)) as Board;
  const [button] = current.grid.buttons;
  return {
    ...current,
    grid: {
      ...current.grid,
      buttons: [
        { ...button, position: { row: 0, column: 1 }, ...(locked === undefined ? {} : { locked }) },
      ],
    },
    expectedVersion: current.version,
    ...extra,
  };
}

async function save(claims: Record<string, unknown>, body: Record<string, unknown>) {
  return app.request(`/v1/boards/${BOARD_ID}`, {
    method: 'PUT',
    headers: await issuer.bearer(claims),
    body: JSON.stringify(body),
  });
}

async function storedColumn(): Promise<number | undefined> {
  const board = (await store.getStore().getBoard(BOARD_ID)) as Board;
  return board.grid.buttons[0]?.position.column;
}

describe('motor-plan override is admin-only on the server', () => {
  before(async () => {
    issuer = await startTestTokenIssuer();
  });

  after(async () => {
    await issuer.close();
  });

  beforeEach(async () => {
    const fresh = fileStore.createFileBoardStore();
    await fresh.resetStoreForTests?.();
    store.useTestStore(fresh);
    await fresh.createBoard(lockedBoard(), 'slp-owner');
  });

  it('an admin of the board organization with the flag → 200, and the button moves', async () => {
    const res = await save(
      { sub: 'admin-1', roles: ['voxa:admin'], org_id: ORG },
      await movedBody({ forceMotorPlanning: true }),
    );
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(await storedColumn(), 1);
  });

  it('an editor of the organization with the flag → 403 with a stable code; nothing is saved', async () => {
    const res = await save(
      { sub: 'editor-1', roles: ['voxa:editor'], org_id: ORG },
      await movedBody({ forceMotorPlanning: true }),
    );
    assert.equal(res.status, 403);
    assert.equal(
      ((await res.json()) as { code: string }).code,
      'MOTOR_PLANNING_OVERRIDE_FORBIDDEN',
    );
    assert.equal(await storedColumn(), 0);
    assert.equal(((await store.getStore().getBoard(BOARD_ID)) as Board).version, 1);
  });

  it('the board owner who is not an admin of its organization cannot override either', async () => {
    const res = await save(
      { sub: 'slp-owner', roles: ['voxa:slp'], org_id: ORG },
      await movedBody({ forceMotorPlanning: true }),
    );
    assert.equal(res.status, 403);
    assert.equal(await storedColumn(), 0);
  });

  it('an editor without the flag who moves a locked button still gets 422', async () => {
    const res = await save(
      { sub: 'editor-1', roles: ['voxa:editor'], org_id: ORG },
      await movedBody(),
    );
    assert.equal(res.status, 422);
    assert.equal(((await res.json()) as { code: string }).code, 'MOTOR_PLANNING_VIOLATION');
    assert.equal(await storedColumn(), 0);
  });

  it('an explicit locked:false in the same save unlocks and moves, for an editor too', async () => {
    const res = await save(
      { sub: 'editor-1', roles: ['voxa:editor'], org_id: ORG },
      await movedBody({}, false),
    );
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(await storedColumn(), 1);
  });

  it('forceMotorPlanning:false is simply no override (422 for a locked move)', async () => {
    const res = await save(
      { sub: 'editor-1', roles: ['voxa:editor'], org_id: ORG },
      await movedBody({ forceMotorPlanning: false }),
    );
    assert.equal(res.status, 422);
  });
});
