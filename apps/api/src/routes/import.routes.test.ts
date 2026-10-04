/**
 * Import acceptance tests (real RS256 tokens): imports create NEW boards owned
 * by the importer and never touch the board being viewed or the shared demo
 * board; spec OBF/OBZ files import with their layout, pictures and links;
 * unsafe archives are rejected with 400.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { DEMO_BOARD_ID, type Board } from '@voxa/core';
import app from '../app.js';
import { resetFileMediaForTests } from '../lib/media-store.js';
import * as fileStore from '../store/file-board-store.js';
import * as store from '../store/index.js';
import { startTestTokenIssuer, type TestTokenIssuer } from '../test-support/janua-tokens.js';

// The API suite runs from apps/api (see package.json `test`).
const fixtures = path.resolve(process.cwd(), '../../fixtures/obf');
const SPEC_BOARD = readFileSync(path.join(fixtures, 'spec-board.obf'), 'utf8');
const SPEC_PACKAGE = readFileSync(path.join(fixtures, 'spec-package.obz'));
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cf00000301010018dd8db40000000049454e44ae426082', 'hex');

let issuer: TestTokenIssuer;
before(async () => {
  issuer = await startTestTokenIssuer();
});
after(async () => {
  await issuer.close();
});

interface ImportResponse {
  boards: Board[];
  rootBoardId: string;
  warnings: string[];
  skipped: { images: number; sounds: number; links: number; buttons: number };
  beta: boolean;
}

async function family(sub: string, extra: Record<string, unknown> = {}) {
  return issuer.bearer({ sub, roles: ['voxa:editor'], voxa_tier: 'family', ...extra });
}

function importFile(format: string, body: string | Uint8Array, headers: Record<string, string>) {
  return app.request(`/v1/boards/import/${format}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': typeof body === 'string' ? 'application/json' : 'application/octet-stream' },
    body: typeof body === 'string' ? body : new Uint8Array(body),
  });
}

async function getBoard(id: string, headers: Record<string, string>): Promise<Board> {
  const res = await app.request(`/v1/boards/${id}`, { headers });
  assert.equal(res.status, 200, `GET ${id}`);
  return (await res.json()) as Board;
}

function at(board: Board, row: number, column: number) {
  return board.grid.buttons.find((btn) => btn.position.row === row && btn.position.column === column);
}

describe('POST /v1/boards/import/:format', () => {
  beforeEach(async () => {
    const fresh = fileStore.createFileBoardStore();
    await fresh.resetStoreForTests?.();
    store.useTestStore(fresh);
    resetFileMediaForTests();
  });

  it('importing while viewing a 47-button board leaves it untouched (same version) and creates a new board', async () => {
    const headers = await family('slp-1');
    const created = await app.request('/v1/boards', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'my-core', name: 'Mi núcleo', profileId: 'p', templateId: 'core-47' }),
    });
    assert.equal(created.status, 201);
    const before = await getBoard('my-core', headers);
    assert.equal(before.grid.buttons.length, 47);

    const res = await importFile('obf', SPEC_BOARD, headers);
    assert.equal(res.status, 201);
    const body = (await res.json()) as ImportResponse;
    assert.equal(body.boards.length, 1);
    assert.notEqual(body.rootBoardId, 'my-core');
    assert.notEqual(body.rootBoardId, 'spec-1', 'never reuses the file id');

    const afterImport = await getBoard('my-core', headers);
    assert.equal(afterImport.version, before.version);
    assert.deepEqual(afterImport, before);
    const imported = await getBoard(body.rootBoardId, headers);
    assert.equal(imported.ownerUserId, 'slp-1');
    assert.equal(imported.name, 'Spec board');
  });

  it('importing on demo-core leaves the shared board untouched; the old in-place endpoint answers 410', async () => {
    const headers = await family('slp-2');
    const demoBefore = await getBoard(DEMO_BOARD_ID, headers);

    const old = await app.request(`/v1/boards/${DEMO_BOARD_ID}/import/obf`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'text/plain' },
      body: SPEC_BOARD,
    });
    assert.equal(old.status, 410);

    const res = await importFile('obf', SPEC_BOARD, headers);
    assert.equal(res.status, 201);
    const body = (await res.json()) as ImportResponse;
    assert.notEqual(body.rootBoardId, DEMO_BOARD_ID);
    assert.deepEqual(await getBoard(DEMO_BOARD_ID, headers), demoBefore);
  });

  it('spec-board.obf: positions follow grid.order; the remote picture is skipped and reported, never fetched', async () => {
    const realFetch = globalThis.fetch;
    const fetched: string[] = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      fetched.push(String(input));
      throw new Error('import must not fetch');
    }) as typeof fetch;
    try {
      const headers = await family('slp-3');
      const res = await importFile('obf', SPEC_BOARD, headers);
      assert.equal(res.status, 201);
      const body = (await res.json()) as ImportResponse;
      const board = body.boards[0]!;
      assert.equal(at(board, 0, 0), undefined);
      assert.equal((at(board, 0, 1) as { label?: string }).label, 'comida');
      assert.equal((at(board, 1, 0) as { speechText?: string }).speechText, 'quiero más');
      const agua = at(board, 1, 1) as { label?: string; symbolUrl?: string };
      assert.equal(agua.label, 'agua');
      assert.equal(agua.symbolUrl, undefined);
      assert.deepEqual(body.skipped, { images: 1, sounds: 0, links: 1, buttons: 0 });
      assert.deepEqual(fetched, []);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('embedded pictures become media of the new board, readable by the importer only', async () => {
    const doc = JSON.parse(SPEC_BOARD);
    doc.images[0] = { id: 'img1', data: `data:image/png;base64,${PNG.toString('base64')}`, width: 1, height: 1, content_type: 'image/png' };
    const headers = await family('slp-4');
    const res = await importFile('obf', JSON.stringify(doc), headers);
    assert.equal(res.status, 201);
    const body = (await res.json()) as ImportResponse;
    const agua = at(body.boards[0]!, 1, 1) as { symbolUrl?: string };
    const mediaPath = new URL(agua.symbolUrl!).pathname;
    assert.match(mediaPath, /^\/v1\/media\/[0-9a-f-]{36}$/);
    assert.equal(body.skipped.images, 0);

    const own = await app.request(mediaPath, { headers });
    assert.equal(own.status, 200);
    assert.equal(own.headers.get('Content-Type'), 'image/png');
    const other = await app.request(mediaPath, { headers: await family('someone-else') });
    assert.equal(other.status, 403);
  });

  it('spec-package.obz imports (no 400) and creates every board of its manifest', async () => {
    const headers = await family('slp-5');
    const res = await importFile('obz', new Uint8Array(SPEC_PACKAGE), headers);
    assert.equal(res.status, 201, await res.clone().text());
    const body = (await res.json()) as ImportResponse;
    const manifest = JSON.parse(strFromU8(unzipSync(new Uint8Array(SPEC_PACKAGE))['manifest.json']!));
    assert.equal(body.boards.length, Object.keys(manifest.paths.boards).length);
    assert.equal(body.rootBoardId, body.boards[0]!.id);
  });

  it('a multi-board .obz creates every board with load_board links remapped to the new ids', async () => {
    const root = JSON.parse(SPEC_BOARD);
    const food = {
      format: 'open-board-0.1', id: 'food', locale: 'es', name: 'Comida',
      grid: { rows: 1, columns: 1, order: [['back']] },
      buttons: [{ id: 'back', label: 'volver', load_board: { id: 'spec-1', path: 'boards/root.obf' } }],
      images: [], sounds: [],
    };
    const archive = zipSync({
      'manifest.json': strToU8(JSON.stringify({
        format: 'open-board-0.1', root: 'boards/root.obf',
        paths: { boards: { 'spec-1': 'boards/root.obf', food: 'boards/food.obf' } },
      })),
      'boards/root.obf': strToU8(JSON.stringify(root)),
      'boards/food.obf': strToU8(JSON.stringify(food)),
    });
    const headers = await family('slp-6');
    const res = await importFile('obz', archive, headers);
    assert.equal(res.status, 201);
    const body = (await res.json()) as ImportResponse;
    assert.equal(body.boards.length, 2);
    const [rootBoard, foodBoard] = body.boards;
    assert.equal(at(rootBoard!, 0, 1)?.navigateToBoardId, foodBoard!.id, 'comida → imported food board');
    assert.equal(at(foodBoard!, 0, 0)?.navigateToBoardId, rootBoard!.id);
    assert.equal(body.skipped.links, 0);
    for (const board of body.boards) assert.equal((await getBoard(board.id as string, headers)).ownerUserId, 'slp-6');
  });

  it('an exported .obz has manifest.json and imports back as a new board', async () => {
    const headers = await family('slp-7');
    await app.request('/v1/boards', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'src', name: 'Fuente', profileId: 'p', templateId: 'core-47' }),
    });
    const exported = await app.request('/v1/boards/src/export/obz', { headers });
    assert.equal(exported.status, 200);
    const archive = new Uint8Array(await exported.arrayBuffer());
    const files = unzipSync(archive);
    assert.ok(files['manifest.json']);
    assert.equal(JSON.parse(strFromU8(files['manifest.json'])).format, 'open-board-0.1');

    const res = await importFile('obz', archive, headers);
    assert.equal(res.status, 201);
    const body = (await res.json()) as ImportResponse;
    const original = await getBoard('src', headers);
    const copy = body.boards[0]!;
    assert.notEqual(copy.id, 'src');
    const sort = (board: Board) => [...board.grid.buttons].sort((a, b) => (a.id as string).localeCompare(b.id as string));
    assert.deepEqual(sort(copy), sort(original), 'locks, POS and symbols survive the OBZ round trip');
  });

  it('creates boards in the importer’s organization and counts them against the plan', async () => {
    const orgHeaders = await family('slp-8', { org_id: 'org-9' });
    const res = await importFile('obf', SPEC_BOARD, orgHeaders);
    assert.equal(res.status, 201);
    const body = (await res.json()) as ImportResponse;
    assert.equal((await getBoard(body.rootBoardId, orgHeaders)).orgId, 'org-9');

    const free = await issuer.bearer({ sub: 'free-user', roles: [] });
    assert.equal((await importFile('obf', SPEC_BOARD, free)).status, 201, 'free plan: first board');
    assert.equal((await importFile('obf', SPEC_BOARD, free)).status, 402, 'free plan: board limit');
  });

  it('rejects zip-slip, oversized and too-many-entries archives with 400', async () => {
    const headers = await family('slp-9');
    const manifest = strToU8(JSON.stringify({ format: 'open-board-0.1', root: 'boards/a.obf', paths: { boards: { a: 'boards/a.obf' } } }));

    const slip = await importFile('obz', zipSync({ 'manifest.json': manifest, '../../etc/evil.obf': strToU8('{}') }), headers);
    assert.equal(slip.status, 400);
    assert.equal(((await slip.json()) as { code: string }).code, 'ZIP_SLIP');

    const oversized = await importFile('obz', new Uint8Array(31 * 1024 * 1024), headers);
    assert.equal(oversized.status, 400);
    assert.equal(((await oversized.json()) as { code: string }).code, 'ARCHIVE_TOO_LARGE');

    const many: Zippable = { 'manifest.json': manifest };
    for (let i = 0; i < 2001; i += 1) many[`images/${i}.png`] = new Uint8Array([1]);
    const tooMany = await importFile('obz', zipSync(many, { level: 0 }), headers);
    assert.equal(tooMany.status, 400);
    assert.equal(((await tooMany.json()) as { code: string }).code, 'TOO_MANY_ENTRIES');

    const bomb = await importFile('obz', zipSync({ 'manifest.json': manifest, 'images/x.png': new Uint8Array(4 * 1024 * 1024) }), headers);
    assert.equal(bomb.status, 400);

    const notObf = await importFile('obf', 'not json', headers);
    assert.equal(notObf.status, 400);
    const unknown = await importFile('docx', 'x', headers);
    assert.equal(unknown.status, 400);

    const boards = (await (await app.request('/v1/boards', { headers })).json()) as { boards: Board[] };
    assert.ok(boards.boards.every((board) => board.ownerUserId !== 'slp-9'), 'nothing was created');
  });
});
