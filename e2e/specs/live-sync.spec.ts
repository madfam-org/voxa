/**
 * Live sync end to end: two signed-in browsers (real encrypted sessions),
 * the built web app and the built API (helpers/local-api.ts, real RS256
 * tokens). Each page opens its WebSocket with a single-use ticket minted
 * through the same-origin proxy; the badge shows Live; an edit saved over HTTP
 * through one session reaches the other session's socket, which reloads the
 * board.
 *
 * Run: build web (with NEXT_PUBLIC_API_URL = VOXA_E2E_API_URL) and the API,
 * start the standalone web with the test-only AUTH_* settings, then
 * `pnpm test:e2e:live`.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ui } from '../helpers/i18n';
import { startLocalApi, type LocalApi } from '../helpers/local-api';
import { seedLocalState, seedTestSession } from '../helpers/test-session';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const API_URL = process.env.VOXA_E2E_API_URL ?? 'http://localhost:4000';
const ORG_ID = 'e2e-live-org';
const OWNER_ID = 'e2e-live-owner';
const EDITOR_ID = 'e2e-live-editor';
const BOARD_ID = 'e2e-live-board';
const SELECTED_BOARD_KEY = 'voxa-selected-board-id';

test.describe.configure({ mode: 'serial' });

let api: LocalApi;
let ownerToken: string;
let editorToken: string;

test.beforeAll(async () => {
  api = await startLocalApi(API_URL);
  ownerToken = api.token({ sub: OWNER_ID, org_id: ORG_ID, roles: ['voxa:editor'] });
  editorToken = api.token({ sub: EDITOR_ID, org_id: ORG_ID, roles: ['voxa:editor'] });
  const headers = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
  for (const token of [ownerToken, editorToken]) {
    const consent = await fetch(`${API_URL}/v1/consents`, {
      method: 'PUT',
      headers: { ...headers, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ consents: { ai_processing: false, usage_analytics: false } }),
    });
    expect(consent.status).toBe(200);
  }
  const created = await fetch(`${API_URL}/v1/boards`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: BOARD_ID,
      name: 'E2E live board',
      profileId: 'default',
      version: 1,
      updatedAt: new Date().toISOString(),
      grid: {
        rows: 1,
        columns: 2,
        buttons: [
          {
            kind: 'analytic',
            id: 'live-word',
            label: 'uno',
            speechText: 'uno',
            locale: 'es-MX',
            position: { row: 0, column: 0 },
            locked: false,
          },
        ],
      },
    }),
  });
  expect(created.status).toBe(201);
});

test.afterAll(async () => {
  await api?.stop();
});

async function openSignedIn(browser: Browser, userId: string, accessToken: string): Promise<Page> {
  const context = await browser.newContext({ locale: 'es-MX' });
  await seedTestSession(context, BASE_URL, { userId, role: 'editor', accessToken });
  const page = await context.newPage();
  await seedLocalState(page);
  await page.addInitScript(
    ({ key, boardId }) => localStorage.setItem(key, boardId),
    { key: SELECTED_BOARD_KEY, boardId: BOARD_ID },
  );
  const tickets: number[] = [];
  page.on('response', (res) => {
    if (res.url().endsWith('/api/v1/ws-ticket')) tickets.push(res.status());
  });
  await page.goto(`${BASE_URL}/app`);
  await expect(page.locator('[data-voxa-button-id="live-word"]')).toContainText('uno', { timeout: 30_000 });
  // The badge: "● En vivo" / "● Live" once the ticketed socket is open.
  await expect(page.getByText(ui('communicator.syncLive', { exact: false }))).toBeVisible({ timeout: 30_000 });
  expect(tickets).toContain(200);
  return page;
}

test('signed-in sessions go Live over a ticketed WebSocket and receive each other’s edits', async ({
  browser,
}) => {
  const owner = await openSignedIn(browser, OWNER_ID, ownerToken);
  const editor = await openSignedIn(browser, EDITOR_ID, editorToken);

  // An edit saved over HTTP through the owner's session (same-origin proxy).
  const saved = await owner.evaluate(async (boardId) => {
    const current = (await (await fetch(`/api/v1/boards/${boardId}`)).json()) as {
      version: number;
      grid: { buttons: Array<Record<string, unknown>> };
    };
    const buttons = current.grid.buttons.map((b) => (b.id === 'live-word' ? { ...b, label: 'dos', speechText: 'dos' } : b));
    const res = await fetch(`/api/v1/boards/${boardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...current, grid: { ...current.grid, buttons }, expectedVersion: current.version }),
    });
    return res.status;
  }, BOARD_ID);
  expect(saved).toBe(200);

  // The editor's socket gets the sync event and its page reloads the board.
  await expect(editor.locator('[data-voxa-button-id="live-word"]')).toContainText('dos', { timeout: 20_000 });
  await expect(editor.getByText(ui('communicator.syncLive', { exact: false }))).toBeVisible();

  await owner.context().close();
  await editor.context().close();
});

test('the socket refuses a reused ticket and an access token in the URL', async ({ browser }) => {
  const minted = await fetch(`${API_URL}/v1/ws-ticket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  expect(minted.status).toBe(200);
  const { ticket } = (await minted.json()) as { ticket: string };
  const wsBase = API_URL.replace(/^http/, 'ws');

  const page = await browser.newPage();
  const status = (url: string) =>
    page.evaluate(
      (target) =>
        new Promise<string>((resolve) => {
          const socket = new WebSocket(target);
          socket.onopen = () => {
            socket.close();
            resolve('open');
          };
          socket.onerror = () => resolve('refused');
        }),
      url,
    );

  expect(await status(`${wsBase}/v1/ws?boardId=${BOARD_ID}&ticket=${ticket}`)).toBe('open');
  expect(await status(`${wsBase}/v1/ws?boardId=${BOARD_ID}&ticket=${ticket}`)).toBe('refused');
  expect(await status(`${wsBase}/v1/ws?boardId=${BOARD_ID}&accessToken=${ownerToken}`)).toBe('refused');
  await page.close();
});
