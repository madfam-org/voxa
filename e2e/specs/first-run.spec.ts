/**
 * First-run setup, against the built standalone web server and a real local
 * API (`helpers/local-api.ts`, real RS256 tokens), with a stubbed
 * `speechSynthesis` so the voice step has device voices to choose from:
 *
 * - a new signed-in user (no board) sees the setup, picks switch scanning,
 *   36 cells and a voice, and ends on /app with a 36-cell es-MX board and
 *   scanning running; the choices are in the communicator settings;
 * - a returning user with a board never sees it; the public /demo never
 *   shows it; "Skip setup" closes it for good and creates nothing;
 * - reopened from Settings by a user who has a board, the last step opens
 *   that board (no second board, no 402);
 * - when the plan limit answers 402 on create, the setup offers the existing
 *   board instead of a dead end;
 * - every step has no WCAG 2.2 AA violations (axe) in a light and a dark
 *   theme.
 *
 * Run like `test:import` (same API port, fixed by the web build):
 * `pnpm --filter @voxa/e2e test:first-run` with PLAYWRIGHT_BASE_URL and
 * VOXA_E2E_API_URL.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { WCAG_TAGS, formatViolations } from '../helpers/a11y';
import { ui } from '../helpers/i18n';
import { startLocalApi, type LocalApi } from '../helpers/local-api';
import { seedLocalState, seedTestSession } from '../helpers/test-session';

const API_URL = process.env.VOXA_E2E_API_URL ?? 'http://localhost:4000';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
/** Must match the storage keys in apps/web/src/lib/communicator-settings.ts. */
const SETTINGS_KEY = 'voxa-communicator-settings';

// The standalone server in CI listens on 127.0.0.1; pin the UI language so
// every run takes the same `/app` -> `/en/app` route. The board language is
// chosen in the setup (es-MX by default), whatever the UI language.
test.use({ locale: 'en-US' });

const VOICES = [
  { voiceURI: 'test:samantha', name: 'Samantha', lang: 'en-US', localService: true, default: true },
  { voiceURI: 'test:paulina-enhanced', name: 'Paulina (Enhanced)', lang: 'es-MX', localService: true, default: false },
  { voiceURI: 'test:paulina', name: 'Paulina', lang: 'es-MX', localService: true, default: false },
];

let api: LocalApi;
let userSeq = 0;

interface TestUser {
  userId: string;
  token: string;
}

interface StoredBoard {
  id: string;
  ownerUserId?: string;
  grid: { rows: number; columns: number; buttons: Array<{ id: string; locale?: string; label?: string }> };
}

async function call(user: TestUser, method: string, route: string, body?: unknown): Promise<Response> {
  return fetch(`${api.url}${route}`, {
    method,
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** A signed-in free-plan user (one board allowed) whose consent is already decided. */
async function newUser(name: string): Promise<TestUser> {
  userSeq += 1;
  const userId = `e2e-first-run-${name}-${userSeq}-${Date.now()}`;
  const user = { userId, token: api.token({ sub: userId, email: `${name}@voxa.test`, name: `E2E ${name}` }) };
  const consent = await call(user, 'PUT', '/v1/consents', { consents: { ai_processing: false, usage_analytics: false } });
  expect(consent.status).toBe(200);
  return user;
}

async function ownedBoards(user: TestUser): Promise<StoredBoard[]> {
  const res = await call(user, 'GET', '/v1/boards');
  expect(res.status).toBe(200);
  const { boards } = (await res.json()) as { boards: StoredBoard[] };
  return boards.filter((board) => board.ownerUserId === user.userId);
}

async function stubSpeech(page: Page): Promise<void> {
  await page.addInitScript((voices) => {
    const target = new EventTarget();
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => voices,
      speak: (u: { onend?: (() => void) | null }) => setTimeout(() => u.onend?.(), 0),
      cancel: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
    class StubUtterance {
      text: string;
      lang = '';
      voice: unknown = null;
      rate = 1;
      pitch = 1;
      volume = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: StubUtterance });
  }, VOICES);
}

async function signIn(
  page: Page,
  context: BrowserContext,
  user: TestUser,
  settings?: Record<string, unknown>,
): Promise<void> {
  await seedTestSession(context, BASE_URL, { userId: user.userId, role: 'communicator', accessToken: user.token });
  await seedLocalState(page);
  await stubSpeech(page);
  if (settings) {
    await page.addInitScript(
      ({ key, value }) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
      },
      { key: SETTINGS_KEY, value: settings },
    );
  }
}

const setupDialog = (page: Page) => page.getByRole('dialog', { name: ui('firstRun.title') });

async function next(page: Page): Promise<void> {
  await setupDialog(page).getByRole('button', { name: ui('firstRun.next') }).click();
}

async function expectStep(page: Page, step: string): Promise<void> {
  await expect(page.locator('[data-voxa-first-run]')).toHaveAttribute('data-voxa-first-run-step', step);
}

async function storedSettings(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>, SETTINGS_KEY);
}

test.beforeAll(async () => {
  api = await startLocalApi(API_URL);
});

test.afterAll(async () => {
  await api?.stop();
});

test('a new user picks switch scanning, 36 cells and a voice, and lands on a 36-cell es-MX board with scanning on', async ({
  page,
  context,
}) => {
  const user = await newUser('new');
  await signIn(page, context, user);
  await page.goto('/app');

  const setup = setupDialog(page);
  await expect(setup).toBeVisible({ timeout: 30_000 });

  // 1. Board language: es-MX is preselected.
  await expectStep(page, 'language');
  await expect(setup.locator('[data-voxa-choice="es-MX"]')).toHaveAttribute('aria-pressed', 'true');
  await next(page);

  // 2. Access method: switch scanning.
  await expectStep(page, 'access');
  await setup.locator('[data-voxa-choice="switch"]').click();
  await expect(setup.locator('[data-voxa-choice="switch"]')).toHaveAttribute('aria-pressed', 'true');
  await next(page);

  // 3. Grid size: 36 cells, with a live preview and the review status.
  await expectStep(page, 'size');
  await setup.locator('[data-voxa-choice="core-24"]').click();
  await expect(setup.locator('[data-voxa-preview-cell]')).toHaveCount(24);
  await setup.locator('[data-voxa-choice="core-36"]').click();
  await expect(setup.locator('[data-voxa-preview-cell]')).toHaveCount(36);
  await expect(setup.locator('[data-voxa-preview-cell="want"]')).toContainText('querer');
  await expect(setup.getByText(ui('firstRun.reviewNote'))).toBeVisible();
  await next(page);

  // 4. Voice: the Voice settings section for es-MX.
  await expectStep(page, 'voice');
  const voiceSelect = setup.locator('[data-voxa-voice-settings] select');
  await expect(voiceSelect.locator('option[value="test:paulina"]')).toHaveCount(1);
  await voiceSelect.selectOption('test:paulina');
  await next(page);

  // 5. Create the board and open it.
  await expectStep(page, 'create');
  await setup.getByRole('button', { name: ui('firstRun.createAction') }).click();
  await expect(setup).toBeHidden({ timeout: 30_000 });

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('[data-voxa-button-id]')).toHaveCount(36, { timeout: 30_000 });
  await expect(page.locator('[data-voxa-button-id="want"]')).toContainText('querer');
  // Switch scanning is running: the scan cursor sits on a cell.
  await expect(page.locator('[data-voxa-scan]').first()).toBeVisible({ timeout: 15_000 });

  const boards = await ownedBoards(user);
  expect(boards).toHaveLength(1);
  expect(boards[0]!.grid.rows * boards[0]!.grid.columns).toBe(36);
  expect(boards[0]!.grid.buttons).toHaveLength(36);
  expect(boards[0]!.grid.buttons.every((button) => button.locale === 'es-MX')).toBe(true);

  const settings = await storedSettings(page);
  expect(settings.accessMode).toBe('switch');
  expect(settings.contentLocale).toBe('es-MX');
  expect((settings.voiceURIByLocale as Record<string, string>)['es-MX']).toBe('test:paulina');

  // Shown once: a reload goes straight to the board.
  await page.reload();
  await expect(page.locator('[data-voxa-button-id]')).toHaveCount(36, { timeout: 30_000 });
  await expect(page.locator('[data-voxa-first-run]')).toHaveCount(0);
});

test('a returning user with a board never sees the setup', async ({ page, context }) => {
  const user = await newUser('returning');
  const created = await call(user, 'POST', '/v1/boards', {
    id: `${user.userId}-board`,
    name: 'Returning board',
    profileId: 'default',
    templateId: 'core-24',
  });
  expect(created.status).toBe(201);
  await signIn(page, context, user);
  await page.goto('/app');
  // The board list has loaded (the board picker lists the user's board).
  await expect(page.getByLabel(ui('communicator.boardSelect'))).toContainText('Returning board', { timeout: 30_000 });
  // Not 'networkidle': same-origin /api calls made while the service worker
  // takes control never report finished. The setup decision follows the board
  // list, which has loaded; give it a moment to (not) appear.
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-voxa-first-run]')).toHaveCount(0);
});

test('the public demo never shows the setup, even to a signed-in user with no board', async ({ page, context }) => {
  const user = await newUser('demo');
  await signIn(page, context, user);
  await page.goto('/demo');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('tablist').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-voxa-first-run]')).toHaveCount(0);
});

test('"Skip setup" closes it for good and creates no board', async ({ page, context }) => {
  const user = await newUser('skip');
  await signIn(page, context, user);
  await page.goto('/app');
  const setup = setupDialog(page);
  await expect(setup).toBeVisible({ timeout: 30_000 });
  await setup.getByRole('button', { name: ui('firstRun.skipAll') }).click();
  await expect(setup).toBeHidden();
  const listed = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/boards') && r.request().method() === 'GET',
    { timeout: 30_000 },
  );
  await page.reload();
  // The setup decision follows the board list (not 'networkidle', see above).
  await listed;
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-voxa-first-run]')).toHaveCount(0);
  expect(await ownedBoards(user)).toHaveLength(0);
});

test('reopened from Settings by a user with a board, the last step opens that board instead of creating another', async ({
  page,
  context,
}) => {
  const user = await newUser('reopen');
  const boardId = `${user.userId}-board`;
  expect((await call(user, 'POST', '/v1/boards', { id: boardId, name: 'Mi tablero', profileId: 'default', templateId: 'core-60' })).status).toBe(201);
  await signIn(page, context, user);
  await page.goto('/app');
  await expect(page.getByLabel(ui('communicator.boardSelect'))).toContainText('Mi tablero', { timeout: 30_000 });

  await page.getByRole('button', { name: ui('common.settings') }).click();
  await page.getByRole('dialog', { name: ui('settings.title') }).getByRole('button', { name: ui('settings.firstRun') }).click();
  const setup = setupDialog(page);
  await expect(setup).toBeVisible();
  for (let i = 0; i < 4; i += 1) await setup.getByRole('button', { name: ui('firstRun.skipStep') }).click();
  await expectStep(page, 'create');
  await expect(setup.getByRole('button', { name: ui('firstRun.createAction') })).toHaveCount(0);
  await setup.getByRole('button', { name: /Mi tablero/ }).click();
  await expect(setup).toBeHidden();
  await expect(page.locator('[data-voxa-button-id]')).toHaveCount(60, { timeout: 30_000 });
  expect(await ownedBoards(user)).toHaveLength(1);
});

test('a 402 from the plan limit on create offers the existing board, not a dead end', async ({ page, context }) => {
  const user = await newUser('limit');
  const boardId = `${user.userId}-board`;
  expect((await call(user, 'POST', '/v1/boards', { id: boardId, name: 'Primer tablero', profileId: 'default', templateId: 'core-24' })).status).toBe(201);
  await signIn(page, context, user);
  // The first board list the page reads is stale (empty), as if the board was
  // created on another device after the list was read.
  let stale = true;
  // The page reads the API through the web's same-origin proxy.
  await page.route('**/api/v1/boards', async (route) => {
    if (route.request().method() === 'GET' && stale) {
      stale = false;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ boards: [] }),
      });
      return;
    }
    await route.fallback();
  });
  await page.goto('/app');
  const setup = setupDialog(page);
  await expect(setup).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 4; i += 1) await setup.getByRole('button', { name: ui('firstRun.skipStep') }).click();
  await setup.getByRole('button', { name: ui('firstRun.createAction') }).click();

  await expect(setup.getByRole('alert')).toContainText(ui('firstRun.limitReached'));
  const open = setup.getByRole('button', { name: /Primer tablero/ });
  await expect(open).toBeVisible({ timeout: 15_000 });
  await open.click();
  await expect(setup).toBeHidden();
  await expect(page.locator('[data-voxa-button-id]')).toHaveCount(24, { timeout: 30_000 });
  expect(await ownedBoards(user)).toHaveLength(1);
});

for (const { theme, colorScheme } of [
  { theme: 'classic-light', colorScheme: 'light' },
  { theme: 'cvi-dark', colorScheme: 'dark' },
] as const) {
  test(`every setup step has no WCAG 2.2 AA violations (${theme}, ${colorScheme})`, async ({ page, context }) => {
    await page.emulateMedia({ colorScheme });
    const user = await newUser(`axe-${theme}`);
    await signIn(page, context, user, { cviTheme: theme });
    await page.goto('/app');
    const setup = setupDialog(page);
    await expect(setup).toBeVisible({ timeout: 30_000 });

    const scan = async (step: string) => {
      await expectStep(page, step);
      const results = await new AxeBuilder({ page }).include('[data-voxa-first-run]').withTags([...WCAG_TAGS]).analyze();
      expect(results.violations, `${step}: ${JSON.stringify(formatViolations(results.violations), null, 2)}`).toEqual([]);
    };

    await scan('language');
    await next(page);
    await setup.locator('[data-voxa-choice="switch"]').click();
    await scan('access');
    await next(page);
    await setup.locator('[data-voxa-choice="core-60"]').click();
    await expect(setup.locator('[data-voxa-preview-cell]')).toHaveCount(60);
    await scan('size');
    await next(page);
    await expect(setup.locator('[data-voxa-voice-settings] select option[value="test:paulina"]')).toHaveCount(1);
    await scan('voice');
    await next(page);
    await scan('create');
  });
}
