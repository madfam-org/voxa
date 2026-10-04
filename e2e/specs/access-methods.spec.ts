/**
 * Access methods against the built standalone web server and a real local
 * API (`helpers/local-api.ts`, real RS256 tokens):
 *
 * - Editor, touch only (`hasTouch`): move a button with taps (Move, then the
 *   destination cell); the order changes and the save reaches the server.
 *   The keyboard move commands work too.
 * - Admin motor-plan override: moving a locked button sends
 *   `forceMotorPlanning` and the server answers 200.
 * - A non-admin cannot move a locked button and is told why, in the UI
 *   language.
 * - A queued save the server refuses with 422 (motor-plan violation) is shown
 *   as a translated error, removed from the queue and never retried.
 * - Classic light on a signed-in board (sync badge, offline banner, footer)
 *   has no serious or critical axe violations.
 *
 * Run: build web (NEXT_PUBLIC_API_URL = VOXA_E2E_API_URL) and the API, start
 * the web server, then `pnpm test:e2e:access` with PLAYWRIGHT_BASE_URL. One
 * worker only (the script passes --workers=1): the API port is fixed by the
 * web build.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { analyzeCurrentPage, blockingViolations, formatViolations } from '../helpers/a11y';
import { ui, uiTexts } from '../helpers/i18n';
import { startLocalApi, type LocalApi } from '../helpers/local-api';
import { seedLocalState, seedTestSession } from '../helpers/test-session';

const API_URL = process.env.VOXA_E2E_API_URL ?? 'http://localhost:4000';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
/** Must match SELECTED_BOARD_KEY / PENDING_SAVE_KEY in apps/web/src/lib/communicator-settings.ts. */
const SELECTED_BOARD_KEY = 'voxa-selected-board-id';
const PENDING_SAVE_KEY = 'voxa-pending-board-save';

// The standalone server in CI listens on 127.0.0.1; pin the UI language so
// every run takes the same locale route.
test.use({ locale: 'en-US' });

let api: LocalApi | null = null;

/**
 * A signed-in test user who owns one board (the free plan allows one board
 * per user, so every test gets its own user).
 */
interface Owner {
  userId: string;
  token: string;
  role: 'editor' | 'admin';
  boardId: string;
}

interface StoredButton {
  id: string;
  position: { row: number; column: number };
  locked: boolean;
}
interface StoredBoard {
  id: string;
  version: number;
  grid: { rows: number; columns: number; buttons: StoredButton[] };
}

async function call(token: string, method: string, route: string, body?: unknown): Promise<Response> {
  return fetch(`${api!.url}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function getBoard(token: string, boardId: string): Promise<StoredBoard> {
  const res = await call(token, 'GET', `/v1/boards/${boardId}`);
  expect(res.status).toBe(200);
  return (await res.json()) as StoredBoard;
}

function position(board: StoredBoard, buttonId: string) {
  return board.grid.buttons.find((b) => b.id === buttonId)?.position;
}

/**
 * A 2x3 board: "uno" locked at (0,0), "dos" (0,1), "tres" (0,2), "cuatro"
 * (1,0); cells (1,1) and (1,2) are empty.
 */
async function seedOwner(name: string, role: 'editor' | 'admin'): Promise<{ owner: Owner; board: StoredBoard }> {
  const userId = `e2e-access-${name}`;
  // The API honours the motor-plan override only for an admin of the board's
  // organization, so the owner's token carries one (the board takes it on create).
  const token = api!.token({
    sub: userId,
    email: `${name}@voxa.test`,
    name: `E2E ${name}`,
    roles: [`voxa:${role}`],
    org_id: 'e2e-access-org',
  });
  const consent = await call(token, 'PUT', '/v1/consents', {
    consents: { ai_processing: false, usage_analytics: false },
  });
  expect(consent.status).toBe(200);
  const boardId = `${userId}-board`;
  const board = await seedBoard(token, boardId);
  return { owner: { userId, token, role, boardId }, board };
}

async function seedBoard(token: string, boardId: string): Promise<StoredBoard> {
  const created = await call(token, 'POST', '/v1/boards', {
    id: boardId,
    name: boardId,
    profileId: 'default',
    version: 1,
    updatedAt: new Date().toISOString(),
    grid: { rows: 2, columns: 3, buttons: [] },
  });
  expect(created.status).toBe(201);
  const { board } = (await created.json()) as { board: StoredBoard };
  const button = (word: string, row: number, column: number, locked = false) => ({
    kind: 'analytic',
    id: `${boardId}-${word}`,
    label: word,
    speechText: word,
    locale: 'es-MX',
    position: { row, column },
    locked,
  });
  const saved = await call(token, 'PUT', `/v1/boards/${boardId}`, {
    ...board,
    grid: {
      rows: 2,
      columns: 3,
      buttons: [button('uno', 0, 0, true), button('dos', 0, 1), button('tres', 0, 2), button('cuatro', 1, 0)],
    },
    expectedVersion: board.version,
  });
  expect(saved.status).toBe(200);
  return ((await saved.json()) as { board: StoredBoard }).board;
}

test.beforeAll(async () => {
  if (!api) api = await startLocalApi(API_URL);
});

test.afterAll(async () => {
  const current = api;
  api = null;
  await current?.stop();
});

async function openBoard(
  page: Page,
  context: BrowserContext,
  options: Owner & { path: '/app' | '/app/edit' },
): Promise<void> {
  await seedTestSession(context, BASE_URL, {
    userId: options.userId,
    role: options.role,
    accessToken: options.token,
  });
  await seedLocalState(page);
  await page.addInitScript(
    ({ key, boardId }) => localStorage.setItem(key, boardId),
    { key: SELECTED_BOARD_KEY, boardId: options.boardId },
  );
  await page.goto(options.path);
  await expect(page.locator(`[data-voxa-button-id="${options.boardId}-dos"]`)).toBeVisible({
    timeout: 30_000,
  });
}

/** Accessible name of an empty editor cell (1-based row and column), any locale. */
function emptyCell(row: number, column: number): RegExp {
  const names = uiTexts('editor.emptyCell').map((text) =>
    text
      .replace('{row}', String(row))
      .replace('{column}', String(column))
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  return new RegExp(`^(?:${names.join('|')})$`);
}

async function gridOrder(page: Page): Promise<string[]> {
  return page
    .locator('[role="grid"] [data-voxa-button-id]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-voxa-button-id') ?? ''));
}

async function saveAndWait(page: Page, boardId: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith(`/v1/boards/${boardId}`)),
    page.getByRole('button', { name: ui('common.save') }).click(),
  ]);
  const response = await request.response();
  return { status: response?.status() ?? 0, body: request.postDataJSON() as Record<string, unknown> };
}

test.describe('editor: single-pointer move', () => {
  test.use({ hasTouch: true });

  test('moves a button with taps only and saves the new order', async ({ page, context }) => {
    const { owner, board: before } = await seedOwner('touch', 'editor');
    const boardId = owner.boardId;
    await openBoard(page, context, { ...owner, path: '/app/edit' });

    expect(await gridOrder(page)).toEqual([`${boardId}-uno`, `${boardId}-dos`, `${boardId}-tres`, `${boardId}-cuatro`]);
    await page.locator(`[data-voxa-button-id="${boardId}-dos"]`).tap();
    await page.getByRole('button', { name: ui('editor.moveStart') }).tap();
    await expect(page.getByRole('status').filter({ hasText: 'dos' })).toBeVisible();
    await page.getByRole('button', { name: emptyCell(2, 3) }).tap();

    expect(await gridOrder(page)).toEqual([`${boardId}-uno`, `${boardId}-tres`, `${boardId}-cuatro`, `${boardId}-dos`]);

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith(`/v1/boards/${boardId}`)),
      page.getByRole('button', { name: ui('common.save') }).tap(),
    ]);
    expect((await request.response())?.status()).toBe(200);
    expect('forceMotorPlanning' in (request.postDataJSON() as object)).toBe(false);

    const after = await getBoard(owner.token, boardId);
    expect(position(after, `${boardId}-dos`)).toEqual({ row: 1, column: 2 });
    expect(after.version).toBe(before.version + 1);
  });

  test('keyboard move commands move the selected button one cell', async ({ page, context }) => {
    const { owner } = await seedOwner('keys', 'editor');
    const boardId = owner.boardId;
    await openBoard(page, context, { ...owner, path: '/app/edit' });

    await page.locator(`[data-voxa-button-id="${boardId}-dos"]`).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: ui('editor.moveRight') }).focus();
    await page.keyboard.press('Enter');
    expect(await gridOrder(page)).toEqual([`${boardId}-uno`, `${boardId}-tres`, `${boardId}-dos`, `${boardId}-cuatro`]);
    const saved = await saveAndWait(page, boardId);
    expect(saved.status).toBe(200);
    expect(position(await getBoard(owner.token, boardId), `${boardId}-dos`)).toEqual({ row: 0, column: 2 });
  });
});

test.describe('motor-plan locks', () => {
  test('an admin override moves a locked button: the save sends forceMotorPlanning and gets 200', async ({
    page,
    context,
  }) => {
    const { owner, board: before } = await seedOwner('override', 'admin');
    const boardId = owner.boardId;
    await openBoard(page, context, { ...owner, path: '/app/edit' });

    await page.locator(`[data-voxa-button-id="${boardId}-uno"]`).click();
    await page.getByRole('button', { name: ui('editor.moveStart') }).click();
    await page.getByRole('button', { name: emptyCell(2, 2) }).click();
    const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog')).filter({
      hasText: ui('communicator.overrideLockConfirm', { exact: false }),
    });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: ui('dialog.ok') }).click();
    expect(await gridOrder(page)).toEqual([`${boardId}-dos`, `${boardId}-tres`, `${boardId}-cuatro`, `${boardId}-uno`]);

    const saved = await saveAndWait(page, boardId);
    expect(saved.body.forceMotorPlanning).toBe(true);
    expect(saved.status).toBe(200);
    const after = await getBoard(owner.token, boardId);
    expect(position(after, `${boardId}-uno`)).toEqual({ row: 1, column: 1 });
    expect(after.version).toBe(before.version + 1);
  });

  test('a non-admin cannot move a locked button and sees the translated reason', async ({ page, context }) => {
    const { owner } = await seedOwner('nonadmin', 'editor');
    const boardId = owner.boardId;
    await openBoard(page, context, { ...owner, path: '/app/edit' });
    const puts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PUT') puts.push(r.url());
    });

    await page.locator(`[data-voxa-button-id="${boardId}-uno"]`).click();
    await page.getByRole('button', { name: ui('editor.moveStart') }).click();
    await expect(page.getByText(ui('communicator.slotLocked'))).toBeVisible();
    await page.getByRole('button', { name: ui('dialog.ok') }).click();
    expect(await gridOrder(page)).toEqual([`${boardId}-uno`, `${boardId}-dos`, `${boardId}-tres`, `${boardId}-cuatro`]);
    expect(puts).toEqual([]);
  });

  test('a queued save refused with 422 shows a translated error, leaves the queue and is not retried', async ({
    page,
    context,
  }) => {
    const { owner, board: before } = await seedOwner('poison', 'editor');
    const boardId = owner.boardId;
    // A save queued earlier (for example while offline) that moves the locked
    // button: the server can never accept it.
    const poisoned: StoredBoard = {
      ...before,
      grid: {
        ...before.grid,
        buttons: before.grid.buttons.map((b) =>
          b.id === `${boardId}-uno` ? { ...b, position: { row: 1, column: 2 } } : b,
        ),
      },
    };
    await page.addInitScript(
      ({ key, value }) => {
        if (!sessionStorage.getItem('e2e-poison-seeded')) {
          localStorage.setItem(key, value);
          sessionStorage.setItem('e2e-poison-seeded', '1');
        }
      },
      { key: `${PENDING_SAVE_KEY}:${boardId}`, value: JSON.stringify(poisoned) },
    );
    const puts: number[] = [];
    page.on('response', (r) => {
      if (r.request().method() === 'PUT' && r.url().endsWith(`/v1/boards/${boardId}`)) puts.push(r.status());
    });

    // Communicator mode: nothing in the page queues a save of its own.
    await openBoard(page, context, { ...owner, path: '/app' });
    await expect(page.getByText(ui('sync.motorPlanRejected', { exact: false }))).toBeVisible({ timeout: 20_000 });
    expect(puts).toEqual([422]);

    const queued = await page.evaluate(async (id) => {
      const local = localStorage.getItem(`voxa-pending-board-save:${id}`);
      const idb = await new Promise<unknown>((resolve) => {
        const open = indexedDB.open('voxa-offline', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('kv');
        open.onerror = () => resolve('idb-error');
        open.onsuccess = () => {
          const req = open.result.transaction('kv', 'readonly').objectStore('kv').get(`pending-board:${id}`);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve('idb-error');
        };
      });
      return { local, idb };
    }, boardId);
    expect(queued).toEqual({ local: null, idb: null });

    // Coming back online flushes the queue; it is empty, so nothing is sent again.
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(3000);
    expect(puts).toEqual([422]);
    const after = await getBoard(owner.token, boardId);
    expect(position(after, `${boardId}-uno`)).toEqual({ row: 0, column: 0 });
    expect(after.version).toBe(before.version);
  });
});

/**
 * The sync badge cannot reach "Live" here: the API's `teamAuth` middleware
 * answers the `/v1/ws` upgrade with 401 (a browser WebSocket cannot send a
 * bearer header), so the badge reads offline for every signed-in user. The
 * "Live" colour is covered by apps/web/src/lib/theme-contrast.test.ts.
 */
test('Classic light on a signed-in board has no serious or critical axe violations', async ({ page, context }) => {
  const { owner } = await seedOwner('theme', 'editor');
  await page.addInitScript(() => {
    localStorage.setItem('voxa-communicator-settings', JSON.stringify({ cviTheme: 'classic-light' }));
  });
  await openBoard(page, context, { ...owner, path: '/app' });
  const results = await analyzeCurrentPage(page);
  const blocking = blockingViolations(results.violations);
  expect(blocking, JSON.stringify(formatViolations(blocking), null, 2)).toEqual([]);
});
