/**
 * Settings that follow the user between devices (opt-in, consent
 * `settings_sync`), against the built standalone web server and a real local
 * API (`helpers/local-api.ts`, real RS256 tokens):
 *
 * - two browser contexts signed in as the same user, consent turned on in
 *   Settings: switch scanning and a slower scan speed chosen in one appear in
 *   the other after a reload;
 * - with the consent off nothing is sent: no request reaches
 *   `/v1/me/settings` (so no PUT) while settings change, and turning the
 *   consent off in Settings deletes the server copy;
 * - the Settings section has no WCAG 2.2 AA violations (axe), off and on.
 *
 * Run like `test:first-run` (same API port, fixed by the web build):
 * `pnpm --filter @voxa/e2e test:settings-sync` with PLAYWRIGHT_BASE_URL and
 * VOXA_E2E_API_URL.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test';
import { WCAG_TAGS, formatViolations } from '../helpers/a11y';
import { ui } from '../helpers/i18n';
import { startLocalApi, type LocalApi } from '../helpers/local-api';
import { seedLocalState, seedTestSession } from '../helpers/test-session';

const API_URL = process.env.VOXA_E2E_API_URL ?? 'http://localhost:4000';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const SETTINGS_PATH = '/v1/me/settings';

test.use({ locale: 'en-US' });

let api: LocalApi;
let userSeq = 0;

interface TestUser {
  userId: string;
  token: string;
}

async function call(user: TestUser, method: string, route: string, body?: unknown): Promise<Response> {
  return fetch(`${api.url}${route}`, {
    method,
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** A signed-in user whose first-run privacy choices are made (settings sync stays undecided = off). */
async function newUser(name: string): Promise<TestUser> {
  userSeq += 1;
  const userId = `e2e-settings-sync-${name}-${userSeq}-${Date.now()}`;
  const user = { userId, token: api.token({ sub: userId, email: `${name}@voxa.test`, name: `E2E ${name}` }) };
  const consent = await call(user, 'PUT', '/v1/consents', { consents: { ai_processing: false, usage_analytics: false } });
  expect(consent.status).toBe(200);
  return user;
}

/** A fresh browser context ("device") signed in as `user`, past the first-run setup. */
async function openDevice(browser: Browser, user: TestUser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: BASE_URL, locale: 'en-US' });
  await seedTestSession(context, BASE_URL, { userId: user.userId, role: 'communicator', accessToken: user.token });
  const page = await context.newPage();
  await seedLocalState(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'skipped'), `voxa-first-run-done:${user.userId}`);
  return { context, page };
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: ui('common.settings') }).click();
  const dialog = page.getByRole('dialog', { name: ui('settings.title') });
  await expect(dialog).toBeVisible();
  return dialog;
}

function syncSection(page: Page) {
  return page.locator('[data-voxa-settings-sync]');
}

async function expectSyncStatus(page: Page, status: string) {
  await expect(page.locator('[data-voxa-settings-sync-status]')).toHaveAttribute(
    'data-voxa-settings-sync-status',
    status,
    { timeout: 20_000 },
  );
}

async function gotoApp(page: Page) {
  await page.goto('/app');
  await expect(page.getByRole('button', { name: ui('common.settings') })).toBeVisible({ timeout: 30_000 });
}

async function axeSection(page: Page) {
  const results = await new AxeBuilder({ page }).include('[data-voxa-settings-sync]').withTags([...WCAG_TAGS]).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(formatViolations(blocking)).toEqual([]);
}

async function serverSettings(user: TestUser): Promise<{ status: number; body: unknown }> {
  const res = await call(user, 'GET', SETTINGS_PATH);
  return { status: res.status, body: await res.json().catch(() => null) };
}

test.beforeAll(async () => {
  api = await startLocalApi(API_URL);
});

test.afterAll(async () => {
  await api?.stop();
});

test('consent on: a scan speed changed on one device appears on the other after a reload', async ({ browser }) => {
  test.setTimeout(120_000);
  const user = await newUser('two-devices');
  const tablet = await openDevice(browser, user);
  const phone = await openDevice(browser, user);
  try {
    // Device 1 turns sync on in Settings (off by default).
    await gotoApp(tablet.page);
    await openSettings(tablet.page);
    await expectSyncStatus(tablet.page, 'off');
    const toggle = syncSection(tablet.page).getByLabel(ui('settingsSync.label'));
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await expectSyncStatus(tablet.page, 'synced');
    await axeSection(tablet.page);

    // Device 2 starts with its own defaults and follows the consent from the server.
    await gotoApp(phone.page);
    await openSettings(phone.page);
    await expect(syncSection(phone.page).getByLabel(ui('settingsSync.label'))).toBeChecked({ timeout: 20_000 });
    await expectSyncStatus(phone.page, 'synced');

    // Device 1: switch scanning, slower scan speed.
    const settings1 = tablet.page.getByRole('dialog', { name: ui('settings.title') });
    await settings1.getByLabel(ui('settings.accessMethod', { exact: false })).selectOption('switch');
    await settings1.locator('input[type="range"][min="300"][max="5000"]').fill('2500');
    await expect
      .poll(async () => {
        const { body } = await serverSettings(user);
        const fields = (body as { fields?: Record<string, { value: unknown }> } | null)?.fields ?? {};
        return [fields.accessMode?.value, fields.switchIntervalMs?.value];
      }, { timeout: 20_000 })
      .toEqual(['switch', 2500]);
    await expectSyncStatus(tablet.page, 'synced');

    // Device 2, after a reload: the same access method and scan speed.
    await phone.page.reload();
    await expect(phone.page.getByRole('button', { name: ui('common.settings') })).toBeVisible({ timeout: 30_000 });
    const settings2 = await openSettings(phone.page);
    await expectSyncStatus(phone.page, 'synced');
    await expect(settings2.getByLabel(ui('settings.accessMethod', { exact: false }))).toHaveValue('switch');
    await expect(settings2.locator('input[type="range"][min="300"][max="5000"]')).toHaveValue('2500');
    const stored = await phone.page.evaluate(() => JSON.parse(localStorage.getItem('voxa-communicator-settings') ?? '{}'));
    expect(stored.switchIntervalMs).toBe(2500);
  } finally {
    await tablet.context.close();
    await phone.context.close();
  }
});

test('consent off: nothing is sent, and turning sync off deletes the server copy', async ({ browser }) => {
  test.setTimeout(120_000);
  const user = await newUser('off');
  const device = await openDevice(browser, user);
  const settingsRequests: Request[] = [];
  device.page.on('request', (request) => {
    // Through the same-origin proxy (/api/v1/me/settings) or straight to the API.
    if (new URL(request.url()).pathname.endsWith(SETTINGS_PATH)) settingsRequests.push(request);
  });
  try {
    await gotoApp(device.page);
    const dialog = await openSettings(device.page);
    await expectSyncStatus(device.page, 'off');
    await axeSection(device.page);
    await dialog.getByLabel(ui('settings.accessMethod', { exact: false })).selectOption('switch');
    await dialog.locator('input[type="range"][min="300"][max="5000"]').fill('3000');
    // Longer than the push pause (1.5 s).
    await device.page.waitForTimeout(3000);
    expect(settingsRequests.filter((r) => r.method() === 'PUT')).toHaveLength(0);
    expect(settingsRequests).toHaveLength(0);
    expect((await serverSettings(user)).status).toBe(403);

    // On, then off again: the copy is stored, then deleted, and changes stop going out.
    const toggle = syncSection(device.page).getByLabel(ui('settingsSync.label'));
    await toggle.check();
    await expectSyncStatus(device.page, 'synced');
    await expect.poll(async () => (await serverSettings(user)).status).toBe(200);
    // The request watch does see settings traffic once sync is on (the "nothing sent" check above is not vacuous).
    expect(settingsRequests.filter((r) => r.method() === 'PUT').length).toBeGreaterThan(0);
    await toggle.uncheck();
    await expectSyncStatus(device.page, 'off');
    expect((await serverSettings(user)).status).toBe(403);
    const consents = (await (await call(user, 'GET', '/v1/consents')).json()) as {
      consents: Array<{ purpose: string; granted: boolean }>;
    };
    expect(consents.consents.find((c) => c.purpose === 'settings_sync')?.granted).toBe(false);
    // Granting again on the API alone finds no old copy.
    await call(user, 'PUT', '/v1/consents', { consents: { settings_sync: true } });
    expect((await serverSettings(user)).body).toEqual({ version: 0, updatedAt: null, fields: {} });
    await call(user, 'PUT', '/v1/consents', { consents: { settings_sync: false } });

    const before = settingsRequests.filter((r) => r.method() === 'PUT').length;
    await dialog.locator('input[type="range"][min="300"][max="5000"]').fill('1500');
    await device.page.waitForTimeout(3000);
    expect(settingsRequests.filter((r) => r.method() === 'PUT')).toHaveLength(before);
  } finally {
    await device.context.close();
  }
});
