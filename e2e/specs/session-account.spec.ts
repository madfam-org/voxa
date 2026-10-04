/**
 * Sessions without tokens in page JavaScript, sign-out with RP-initiated
 * logout, account switching and shared-tablet privacy, against the built web
 * app.
 *
 * Janua is replaced by an in-process stand-in on VOXA_E2E_JANUA_PORT (the CI
 * a11y job starts the web server with AUTH_JANUA_ISSUER pointing at it): it
 * serves discovery, records the authorize and logout requests the browser
 * makes, and sends logout back to the post-logout redirect like Janua does.
 * The session is a real Auth.js cookie encrypted with the test-only
 * AUTH_SECRET (helpers/test-session.ts).
 */
import { createServer, type Server } from 'node:http';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { analyzePage, formatViolations } from '../helpers/a11y';
import { ui } from '../helpers/i18n';
import { seedLocalState, seedTestSession, sessionCookieNameFor } from '../helpers/test-session';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const JANUA_PORT = Number(process.env.VOXA_E2E_JANUA_PORT ?? 4455);
const ISSUER = `http://127.0.0.1:${JANUA_PORT}`;
const BOARD_CACHE_KEY = 'voxa-board-cache';
const PENDING_SAVE_KEY = 'voxa-pending-board-save';
const SELECTED_BOARD_KEY = 'voxa-selected-board-id';

test.describe.configure({ mode: 'serial' });

let janua: Server;
const authorizeRequests: URL[] = [];
const logoutRequests: URL[] = [];

test.beforeAll(async () => {
  janua = createServer((req, res) => {
    const url = new URL(req.url ?? '/', ISSUER);
    if (url.pathname === '/.well-known/openid-configuration') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/api/v1/oauth/authorize`,
          token_endpoint: `${ISSUER}/api/v1/oauth/token`,
          jwks_uri: `${ISSUER}/.well-known/jwks.json`,
          end_session_endpoint: `${ISSUER}/logout`,
          code_challenge_methods_supported: ['S256'],
        }),
      );
      return;
    }
    if (url.pathname === '/api/v1/oauth/authorize') {
      authorizeRequests.push(url);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="en"><title>Janua</title><h1>Janua sign-in</h1></html>');
      return;
    }
    if (url.pathname === '/logout') {
      logoutRequests.push(url);
      res.writeHead(302, { Location: url.searchParams.get('post_logout_redirect_uri') ?? '/' });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => janua.listen(JANUA_PORT, '127.0.0.1', resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => janua.close(() => resolve()));
});

test.beforeEach(() => {
  authorizeRequests.length = 0;
  logoutRequests.length = 0;
});

/** Opens /app signed in and returns the built-in demo board the app cached (no API runs here). */
async function openApp(page: Page, context: BrowserContext, userId: string): Promise<Record<string, unknown>> {
  await seedTestSession(context, BASE_URL, { userId, role: 'communicator', idToken: 'e2e-id-token' });
  await seedLocalState(page);
  await page.goto('/app');
  const demoKey = `${BOARD_CACHE_KEY}:demo-core`;
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, demoKey, { timeout: 30_000 });
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), demoKey);
}

test('signed in, /app renders the board and page scripts never see a token', async ({ page, context }) => {
  await openApp(page, context, 'e2e-user-a');
  const buttons = page.locator('[data-voxa-button-id]');
  await expect.poll(() => buttons.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(47);

  const session = await page.evaluate(async () => {
    const res = await fetch('/api/auth/session');
    return { status: res.status, text: await res.text() };
  });
  expect(session.status).toBe(200);
  for (const key of ['accessToken', 'access_token', 'refreshToken', 'refresh_token', 'idToken', 'id_token']) {
    expect(session.text).not.toContain(`"${key}"`);
  }
  expect(session.text).not.toContain('eyJ');
  expect(JSON.parse(session.text).user.id).toBe('e2e-user-a');

  // The helper seeds both loopback host names and the server may move the page
  // from one to the other: the page's own origin is the one that counts.
  const cookies = await context.cookies(new URL(page.url()).origin);
  const sessionCookie = cookies.find((c) => c.name.startsWith(sessionCookieNameFor(BASE_URL)));
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.value).not.toContain('eyJ');
  expect(await page.evaluate(() => document.cookie)).not.toContain('authjs');
});

test('the sign-in page offers both switching controls and passes axe', async ({ page }) => {
  const results = await analyzePage(page, '/auth/signin');
  expect(results.violations, JSON.stringify(formatViolations(results.violations), null, 2)).toEqual([]);
  await expect(page.getByRole('button', { name: ui('auth.continueJanua') })).toBeVisible();
  await expect(page.getByRole('button', { name: ui('auth.switchAccount') })).toBeVisible();
  await expect(page.getByRole('button', { name: ui('auth.signInAsSomeoneElse') })).toBeVisible();
});

for (const [control, prompt] of [
  ['auth.switchAccount', 'select_account'],
  ['auth.signInAsSomeoneElse', 'login'],
] as const) {
  test(`sign-in page: ${control} goes to Janua with prompt=${prompt}`, async ({ page }) => {
    // A decided consent keeps the first-run privacy banner from covering the
    // lower controls on a short viewport.
    await seedLocalState(page);
    await page.goto('/auth/signin');
    await page.getByRole('button', { name: ui(control) }).click();
    await page.waitForURL((url) => url.href.startsWith(`${ISSUER}/api/v1/oauth/authorize`), { timeout: 30_000 });
    const authorize = authorizeRequests.at(-1)!;
    expect(authorize.searchParams.get('prompt')).toBe(prompt);
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorize.searchParams.get('state')).toBeTruthy();
    expect(authorize.searchParams.get('nonce')).toBeTruthy();
    expect(authorize.searchParams.get('redirect_uri')).toMatch(/\/api\/auth\/callback\/janua$/);
  });
}

test('sign-out purges this account’s local data, then ends the Janua session', async ({ page, context }) => {
  await openApp(page, context, 'e2e-user-a');
  await page.evaluate(
    ({ cache, pending, selected }) => {
      localStorage.setItem(`${cache}:family-board`, '{"id":"family-board"}');
      localStorage.setItem(`${pending}:family-board`, '{"ownerUserId":"e2e-user-a","board":{}}');
      localStorage.setItem(selected, 'family-board');
    },
    { cache: BOARD_CACHE_KEY, pending: PENDING_SAVE_KEY, selected: SELECTED_BOARD_KEY },
  );

  await page.getByRole('button', { name: ui('auth.signOut') }).click();
  await page.waitForURL(/\/auth\/signin/, { timeout: 30_000 });

  const logout = logoutRequests.at(-1)!;
  expect(logout.searchParams.get('id_token_hint')).toBe('e2e-id-token');
  expect(logout.searchParams.get('post_logout_redirect_uri')).toMatch(/\/auth\/signin$/);
  expect(logout.searchParams.get('client_id')).toBeTruthy();

  const left = await page.evaluate(() =>
    Object.keys(localStorage).filter(
      (key) => key.startsWith('voxa-board-cache') || key.startsWith('voxa-pending-board-save') || key === 'voxa-selected-board-id',
    ),
  );
  expect(left).toEqual([]);
  const shells = await page.evaluate(async () => (await caches.keys()).filter((n) => n.startsWith('voxa-shell-')));
  expect(shells).toEqual([]);
  // The helper seeds both loopback host names and the server may move the page
  // from one to the other: the page's own origin is the one that counts.
  const cookies = await context.cookies(new URL(page.url()).origin);
  expect(cookies.some((c) => c.name.startsWith(sessionCookieNameFor(BASE_URL)))).toBe(false);
  const origin = new URL(page.url()).origin;
  expect(await (await page.request.get(`${origin}/api/auth/session`)).json()).toBeNull();
  expect((await page.request.get(`${origin}/api/v1/boards`)).status()).toBe(401);
});

test('GET /auth/signout answers 405', async ({ request }) => {
  expect((await request.get('/auth/signout', { maxRedirects: 0 })).status()).toBe(405);
});

test('«Entrar como otra persona» on the signed-in surface purges, signs out and asks Janua for a login', async ({
  page,
  context,
}) => {
  await openApp(page, context, 'e2e-user-a');
  // The app's own origin (the server may have moved the page between loopback names).
  const appOrigin = new URL(page.url()).origin;
  await page.evaluate((key) => localStorage.setItem(`${key}:family-board`, '{"id":"family-board"}'), BOARD_CACHE_KEY);
  await page.getByRole('button', { name: ui('auth.signInAsSomeoneElse') }).click();
  await page.waitForURL((url) => url.href.startsWith(`${ISSUER}/api/v1/oauth/authorize`), { timeout: 30_000 });
  expect(authorizeRequests.at(-1)!.searchParams.get('prompt')).toBe('login');

  const cookies = await context.cookies(appOrigin);
  expect(cookies.some((c) => c.name.startsWith(sessionCookieNameFor(BASE_URL)))).toBe(false);
  await page.goto(`${appOrigin}/auth/signin`);
  expect(await page.evaluate((key) => localStorage.getItem(`${key}:family-board`), BOARD_CACHE_KEY)).toBeNull();
});

test('a write queued by user A is never sent under user B', async ({ page, context }) => {
  const demo = await openApp(page, context, 'e2e-user-b');
  const owned = { ...demo, id: 'e2e-owned-board', name: 'Owned by B', ownerUserId: 'e2e-user-b', version: 1 };
  const puts: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'PUT' && path === '/api/v1/boards/e2e-owned-board') {
      puts.push(request.postData() ?? '');
      const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
      return route.fulfill({ json: { board: { ...body, version: 2 }, event: { type: 'board.updated' } } });
    }
    if (request.method() === 'GET' && path === '/api/v1/boards/e2e-owned-board') return route.fulfill({ json: owned });
    if (request.method() === 'GET' && path === '/api/v1/boards') return route.fulfill({ json: { boards: [owned] } });
    if (path === '/api/v1/consents') {
      return route.fulfill({
        json: {
          policyVersion: 'v',
          consents: [
            { purpose: 'ai_processing', granted: false },
            { purpose: 'usage_analytics', granted: false },
          ],
          utteranceTextAvailable: false,
        },
      });
    }
    return route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
  });

  // Queued under A on this tablet (B is signed in now).
  await page.evaluate(
    ({ pending, selected, board }) => {
      localStorage.setItem(selected, board.id as string);
      localStorage.setItem(
        `${pending}:${board.id as string}`,
        JSON.stringify({ ownerUserId: 'e2e-user-a', board: { ...board, name: 'Edited by A' } }),
      );
    },
    { pending: PENDING_SAVE_KEY, selected: SELECTED_BOARD_KEY, board: owned },
  );
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: ui('sync.pendingDroppedOtherAccount', { exact: false }) })).toBeVisible({
    timeout: 30_000,
  });
  expect(puts).toEqual([]);
  expect(await page.evaluate((key) => localStorage.getItem(key), `${PENDING_SAVE_KEY}:e2e-owned-board`)).toBeNull();

  // Control: B's own queued write is sent.
  await page.evaluate(
    ({ pending, board }) => {
      localStorage.setItem(
        `${pending}:${board.id as string}`,
        JSON.stringify({ ownerUserId: 'e2e-user-b', board: { ...board, name: 'Edited by B' } }),
      );
    },
    { pending: PENDING_SAVE_KEY, board: owned },
  );
  await page.reload();
  await expect.poll(() => puts.length, { timeout: 30_000 }).toBeGreaterThan(0);
  expect(puts.join('')).toContain('Edited by B');
  expect(puts.join('')).not.toContain('Edited by A');
});
