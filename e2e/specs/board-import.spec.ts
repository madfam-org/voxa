/**
 * Board import in the editor, against the built standalone web server and a
 * real local API (`helpers/local-api.ts`, real RS256 tokens):
 *
 * - importing an Open Board Format file asks for confirmation, creates a NEW
 *   board and opens it; the board that was on screen keeps its version and
 *   its 47 buttons;
 * - the one-page adapters (Grid 3, Snap, TouchChat) are labelled beta.
 *
 * Run like `test:offline` (same API port, fixed by the web build):
 * `pnpm --filter @voxa/e2e test:import` with PLAYWRIGHT_BASE_URL and
 * VOXA_E2E_API_URL.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ui } from '../helpers/i18n';
import { startLocalApi, type LocalApi } from '../helpers/local-api';
import { seedLocalState, seedTestSession } from '../helpers/test-session';

const API_URL = process.env.VOXA_E2E_API_URL ?? 'http://localhost:4000';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const OWNER_ID = 'e2e-import-owner';
const BOARD_ID = 'e2e-import-core';
/** Must match SELECTED_BOARD_KEY in apps/web/src/lib/communicator-settings.ts. */
const SELECTED_BOARD_KEY = 'voxa-selected-board-id';
const SPEC_BOARD = readFileSync(path.join(__dirname, '..', '..', 'fixtures', 'obf', 'spec-board.obf'));

test.use({ locale: 'en-US' });

let api: LocalApi;
let ownerToken: string;

async function apiCall(method: string, route: string, body?: unknown): Promise<Response> {
  return fetch(`${api.url}${route}`, {
    method,
    headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test.beforeAll(async () => {
  api = await startLocalApi(API_URL);
  ownerToken = api.token({ sub: OWNER_ID, email: 'import@voxa.test', name: 'E2E Import', voxa_tier: 'family' });
  expect((await apiCall('PUT', '/v1/consents', { consents: { ai_processing: false, usage_analytics: false } })).status).toBe(200);
  const created = await apiCall('POST', '/v1/boards', {
    id: BOARD_ID,
    name: 'E2E core',
    profileId: 'default',
    templateId: 'core-47',
  });
  expect(created.status).toBe(201);
});

test.afterAll(async () => {
  await api?.stop();
});

test('importing an OBF file confirms, creates a new board and opens it; the board on screen is untouched', async ({
  page,
  context,
}) => {
  const before = (await (await apiCall('GET', `/v1/boards/${BOARD_ID}`)).json()) as {
    version: number;
    grid: { buttons: unknown[] };
  };
  expect(before.grid.buttons).toHaveLength(47);

  await seedTestSession(context, BASE_URL, { userId: OWNER_ID, role: 'communicator', accessToken: ownerToken });
  await seedLocalState(page);
  await page.addInitScript(({ key, boardId }) => localStorage.setItem(key, boardId), {
    key: SELECTED_BOARD_KEY,
    boardId: BOARD_ID,
  });
  await page.goto('/app');
  await expect(page.locator('[data-voxa-button-id]')).toHaveCount(47, { timeout: 30_000 });

  await page.getByLabel(ui('communicator.teamRole')).selectOption('editor');

  const grid = page.getByRole('button', { name: ui('communicator.importGrid') });
  await expect(grid).toBeVisible();
  await expect(grid).toHaveAccessibleName(/beta/i);
  await expect(page.getByRole('button', { name: ui('communicator.importSnap') })).toHaveAccessibleName(/beta/i);
  await expect(page.getByRole('button', { name: ui('communicator.importTouchChat') })).toHaveAccessibleName(/beta/i);

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: ui('communicator.importObf') }).click();
  await (await chooser).setFiles({ name: 'spec-board.obf', mimeType: 'application/json', buffer: SPEC_BOARD });

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(ui('communicator.importConfirm'))).toBeVisible();
  await dialog.getByRole('button', { name: ui('communicator.importConfirmAction') }).click();

  // The remote picture of the file is not downloaded: the app says so.
  await expect(page.getByRole('dialog')).toContainText(/not imported/i);
  await page.getByRole('dialog').getByRole('button', { name: ui('dialog.ok') }).click();

  // The imported board is open (agua, más, comida) and selected.
  await expect(page.locator('[data-voxa-button-id]')).toHaveCount(3, { timeout: 30_000 });
  await expect(page.locator('[data-voxa-button-id="b3"]')).toContainText('comida');
  const selected = await page.evaluate((key) => localStorage.getItem(key), SELECTED_BOARD_KEY);
  expect(selected).not.toBe(BOARD_ID);
  expect(selected).toMatch(/^board-/);

  const after = (await (await apiCall('GET', `/v1/boards/${BOARD_ID}`)).json()) as {
    version: number;
    grid: { buttons: unknown[] };
  };
  expect(after.version).toBe(before.version);
  expect(after.grid.buttons).toHaveLength(47);
  const imported = (await (await apiCall('GET', `/v1/boards/${selected}`)).json()) as { ownerUserId: string; name: string };
  expect(imported.ownerUserId).toBe(OWNER_ID);
  expect(imported.name).toBe('Spec board');
});
