/**
 * Media read and upload rights through the bearer-token path, the one the
 * web app's same-origin media proxy (`apps/web/src/app/api/media/[id]`) uses:
 * owner 200, another user 403, an editor of the board's organization 200, an
 * editor of another organization 403, unknown id 404, and the shared demo
 * board accepts no uploads.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { DEMO_BOARD_ID } from '@voxa/core';
import app from '../app.js';
import { resetFileMediaForTests } from '../lib/media-store.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';
import { startTestTokenIssuer, type TestTokenIssuer } from '../test-support/janua-tokens.js';

let issuer: TestTokenIssuer;

before(async () => {
  issuer = await startTestTokenIssuer();
});

after(async () => {
  await issuer.close();
});

async function auth(claims: Record<string, unknown>): Promise<Record<string, string>> {
  const headers = await issuer.bearer(claims);
  return { Authorization: headers.Authorization ?? '' };
}

async function createBoard(id: string, claims: Record<string, unknown>): Promise<void> {
  const res = await app.request('/v1/boards', {
    method: 'POST',
    headers: { ...(await auth(claims)), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      name: `Board ${id}`,
      profileId: 'default',
      version: 1,
      updatedAt: new Date().toISOString(),
      grid: { rows: 2, columns: 2, buttons: [] },
    }),
  });
  assert.equal(res.status, 201, await res.clone().text());
}

async function upload(boardId: string, claims: Record<string, unknown>): Promise<Response> {
  const form = new FormData();
  form.set('boardId', boardId);
  form.set(
    'file',
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'photo.png', { type: 'image/png' }),
  );
  return app.request('/v1/media', { method: 'POST', headers: await auth(claims), body: form });
}

describe('media access with Janua bearer tokens', () => {
  beforeEach(async () => {
    resetFileMediaForTests();
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    useTestStore(store);
  });

  it('owner reads 200; another user 403; unknown id 404', async () => {
    const owner = { sub: 'owner-1' };
    await createBoard('owned-board', owner);
    const post = await upload('owned-board', owner);
    assert.equal(post.status, 201);
    const { id } = (await post.json()) as { id: string };

    const mine = await app.request(`/v1/media/${id}`, { headers: await auth(owner) });
    assert.equal(mine.status, 200);
    assert.equal(mine.headers.get('Content-Type'), 'image/png');
    assert.match(mine.headers.get('Cache-Control') ?? '', /^private\b/);

    const other = await app.request(`/v1/media/${id}`, { headers: await auth({ sub: 'user-2' }) });
    assert.equal(other.status, 403);

    const missing = await app.request('/v1/media/00000000-0000-4000-8000-000000000000', {
      headers: await auth(owner),
    });
    assert.equal(missing.status, 404);

    // Without a token: 401 in production; the test preload enables the
    // development identity, which is a different user here (403).
    const anonymous = await app.request(`/v1/media/${id}`);
    assert.ok([401, 403].includes(anonymous.status), `status ${anonymous.status}`);
  });

  it('organization scope: an editor of the same org reads 200, of another org 403', async () => {
    const owner = { sub: 'owner-1', org_id: 'org-a' };
    await createBoard('org-board', owner);
    const post = await upload('org-board', owner);
    assert.equal(post.status, 201);
    const { id } = (await post.json()) as { id: string };

    const sameOrg = await app.request(`/v1/media/${id}`, {
      headers: await auth({ sub: 'slp-1', org_id: 'org-a', roles: ['voxa:editor'] }),
    });
    assert.equal(sameOrg.status, 200);

    const otherOrg = await app.request(`/v1/media/${id}`, {
      headers: await auth({ sub: 'slp-2', org_id: 'org-b', roles: ['voxa:editor'] }),
    });
    assert.equal(otherOrg.status, 403);
  });

  it('the shared demo board is read-only: uploads are refused', async () => {
    const res = await upload(DEMO_BOARD_ID, { sub: 'owner-1', roles: ['voxa:admin'] });
    assert.ok(res.status === 403 || res.status === 404, `status ${res.status}`);
  });
});
