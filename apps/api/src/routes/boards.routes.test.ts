import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { createBoardId, createDemoBoard, DEMO_BOARD_ID } from '@voxa/core';
import app from '../app.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';
import { createOwnedBoard, devHeaders } from '../test-support/boards.js';

describe('board routes', () => {
  beforeEach(async () => {
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    useTestStore(store);
  });

  it('lists demo board without auth headers', async () => {
    const res = await app.request('/v1/boards');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { boards: Array<{ id: string }> };
    assert.ok(body.boards.some((board) => board.id === DEMO_BOARD_ID));
  });

  it('returns 404 for unknown board', async () => {
    const res = await app.request('/v1/boards/missing-board');
    assert.equal(res.status, 404);
  });

  it('hides private boards from other users', async () => {
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    const privateBoard = {
      ...createDemoBoard(),
      id: createBoardId('private-team'),
      name: 'Private',
      ownerUserId: 'owner-a',
    };
    await store.createBoard(privateBoard, 'owner-a');
    useTestStore(store);

    const res = await app.request('/v1/boards', {
      headers: { 'X-Voxa-User-Id': 'other-user', 'X-Voxa-Role': 'communicator' },
    });
    const body = (await res.json()) as { boards: Array<{ id: string }> };
    assert.ok(body.boards.some((board) => board.id === DEMO_BOARD_ID));
    assert.ok(!body.boards.some((board) => board.id === 'private-team'));
  });

  it('returns 403 when accessing a private board as another user', async () => {
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    const privateBoard = {
      ...createDemoBoard(),
      id: createBoardId('secret-board'),
      name: 'Secret',
      ownerUserId: 'owner-a',
    };
    await store.createBoard(privateBoard, 'owner-a');
    useTestStore(store);

    const res = await app.request('/v1/boards/secret-board', {
      headers: { 'X-Voxa-User-Id': 'intruder', 'X-Voxa-Role': 'communicator' },
    });
    assert.equal(res.status, 403);
  });

  it('lets the owner update a board and refuses other communicators', async () => {
    await createOwnedBoard(app, 'owner-a', 'owned-board');
    const board = (await (
      await app.request('/v1/boards/owned-board', { headers: devHeaders('owner-a') })
    ).json()) as { name: string; version: number };

    const denied = await app.request('/v1/boards/owned-board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...devHeaders('someone-else') },
      body: JSON.stringify({ ...board, name: 'Blocked rename' }),
    });
    assert.equal(denied.status, 403);

    const allowed = await app.request('/v1/boards/owned-board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...devHeaders('owner-a') },
      body: JSON.stringify({ ...board, name: 'Updated core', expectedVersion: board.version }),
    });
    assert.equal(allowed.status, 200);
    const updated = (await allowed.json()) as { board: { name: string; version: number } };
    assert.equal(updated.board.name, 'Updated core');
    assert.equal(updated.board.version, board.version + 1);
  });

  it('deletes a user board but not demo-core', async () => {
    const create = await app.request('/v1/boards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voxa-User-Id': 'owner-a',
        'X-Voxa-Role': 'editor',
      },
      body: JSON.stringify({
        id: 'temp-board',
        name: 'Temp',
        profileId: 'default',
        version: 1,
        updatedAt: new Date().toISOString(),
        grid: { rows: 3, columns: 3, buttons: [] },
      }),
    });
    assert.equal(create.status, 201);

    const deleted = await app.request('/v1/boards/temp-board', {
      method: 'DELETE',
      headers: { 'X-Voxa-User-Id': 'owner-a', 'X-Voxa-Role': 'editor' },
    });
    assert.equal(deleted.status, 204);

    const demoDelete = await app.request(`/v1/boards/${DEMO_BOARD_ID}`, {
      method: 'DELETE',
      headers: { 'X-Voxa-User-Id': 'owner-a', 'X-Voxa-Role': 'editor' },
    });
    assert.equal(demoDelete.status, 403);
  });

  it('returns the edit audit log to people who may edit the board', async () => {
    await createOwnedBoard(app, 'slp-remote', 'audited-board', 'editor');
    const board = (await (
      await app.request('/v1/boards/audited-board', { headers: devHeaders('slp-remote', 'editor') })
    ).json()) as { name: string; version: number };

    await app.request('/v1/boards/audited-board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...devHeaders('slp-remote', 'editor') },
      body: JSON.stringify({ ...board, name: 'Audit test board', expectedVersion: board.version }),
    });

    const audit = await app.request('/v1/boards/audited-board/audit', {
      headers: devHeaders('slp-remote', 'editor'),
    });
    assert.equal(audit.status, 200);
    const body = (await audit.json()) as { events: Array<{ actorUserId: string }> };
    assert.ok(body.events.length >= 1);
    assert.equal(body.events[0]?.actorUserId, 'slp-remote');

    const demoAudit = await app.request(`/v1/boards/${DEMO_BOARD_ID}/audit`, {
      headers: devHeaders('slp-remote', 'editor'),
    });
    assert.equal(demoAudit.status, 403);
  });
  it('creates starter templates in the requested content locale (es-MX by default)', async () => {
    // One owner per board: a free plan allows a single owned board.
    const headersFor = (id: unknown) => ({
      'Content-Type': 'application/json',
      'X-Voxa-User-Id': `owner-${String(id)}`,
      'X-Voxa-Role': 'editor',
    });
    const base = {
      profileId: 'default',
      version: 1,
      updatedAt: new Date().toISOString(),
      grid: { rows: 1, columns: 1, buttons: [] },
    };
    const create = (body: Record<string, unknown>) =>
      app.request('/v1/boards', {
        method: 'POST',
        headers: headersFor(body.id),
        body: JSON.stringify({ ...base, ...body }),
      });

    const spanish = await create({ id: 'tpl-es', name: 'Núcleo', templateId: 'core-47', contentLocale: 'es-MX' });
    assert.equal(spanish.status, 201);
    const es = (await spanish.json()) as { board: { grid: { buttons: Array<{ locale: string; label: string }> } } };
    assert.equal(es.board.grid.buttons.length, 47);
    assert.ok(es.board.grid.buttons.every((button) => button.locale === 'es-MX'));
    assert.ok(es.board.grid.buttons.some((button) => button.label === 'querer'));

    const unspecified = await create({ id: 'tpl-default', name: 'Default', templateId: 'core-47' });
    assert.equal(unspecified.status, 201);
    const def = (await unspecified.json()) as { board: { grid: { buttons: Array<{ locale: string }> } } };
    assert.ok(def.board.grid.buttons.every((button) => button.locale === 'es-MX'));

    const english = await create({ id: 'tpl-en', name: 'Core', templateId: 'core-47', contentLocale: 'en-US' });
    const en = (await english.json()) as { board: { grid: { buttons: Array<{ locale: string; label: string }> } } };
    assert.ok(en.board.grid.buttons.every((button) => button.locale === 'en-US'));
    assert.ok(en.board.grid.buttons.some((button) => button.label === 'want'));

    const invalid = await create({ id: 'tpl-bad', name: 'Bad', templateId: 'core-47', contentLocale: 'de-DE' });
    assert.equal(invalid.status, 400);
  });

  it('creates the 24, 36 and 60 cell core boards with one motor plan, and refuses an unknown template with 400', async () => {
    const create = (id: string, body: Record<string, unknown>) =>
      app.request('/v1/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Voxa-User-Id': `owner-${id}`, 'X-Voxa-Role': 'editor' },
        body: JSON.stringify({
          id,
          name: id,
          profileId: 'default',
          version: 1,
          updatedAt: new Date().toISOString(),
          grid: { rows: 1, columns: 1, buttons: [] },
          ...body,
        }),
      });
    type Created = { board: { grid: { rows: number; columns: number; buttons: Array<{ id: string; locale: string; label: string; position: { row: number; column: number } }> } } };
    const boards: Created['board'][] = [];
    for (const [templateId, rows, columns] of [
      ['core-24', 4, 6],
      ['core-36', 6, 6],
      ['core-60', 6, 10],
    ] as const) {
      const res = await create(`sized-${templateId}`, { templateId });
      assert.equal(res.status, 201, templateId);
      const { board } = (await res.json()) as Created;
      assert.equal(board.grid.rows, rows);
      assert.equal(board.grid.columns, columns);
      assert.equal(board.grid.buttons.length, rows * columns);
      assert.ok(board.grid.buttons.every((button) => button.locale === 'es-MX'));
      boards.push(board);
    }
    const at = (board: Created['board']) => new Map(board.grid.buttons.map((b) => [b.id, `${b.position.row},${b.position.column}`]));
    const large = at(boards[2]!);
    for (const [id, cell] of at(boards[0]!)) assert.equal(large.get(id), cell, `${id} moved`);

    const templates = (await (await app.request('/v1/boards/templates/list', { headers: devHeaders('lister') })).json()) as {
      templates: Array<{ id: string; vocabularyReview?: string }>;
    };
    for (const id of ['core-24', 'core-36', 'core-60']) {
      assert.equal(templates.templates.find((t) => t.id === id)?.vocabularyReview, 'pending-clinical-review');
    }

    for (const bad of ['core-84', '__proto__', 42]) {
      const res = await create(`bad-${String(bad)}`, { templateId: bad });
      assert.equal(res.status, 400, String(bad));
    }
  });
});
