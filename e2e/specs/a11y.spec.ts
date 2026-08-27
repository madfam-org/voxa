import { test, expect } from '@playwright/test';
import { analyzePage, analyzeCurrentPage, formatViolations } from '../helpers/a11y';
import { hasJanuaTestCredentials } from '../helpers/janua-login';
import {
  enterEditorMode,
  openAccessibilitySettings,
  prepareAuthenticatedApp,
} from '../helpers/app-session';
import { openAuthenticatedEditor } from '../helpers/test-session';

const PUBLIC_PAGES = [
  { name: 'home', path: '/' },
  { name: 'live demo', path: '/demo' },
  { name: 'privacy', path: '/legal/privacy' },
  { name: 'terms', path: '/legal/terms' },
  { name: 'accessibility statement', path: '/legal/accessibility' },
  { name: 'sign-in', path: '/auth/signin' },
] as const;

test.describe('Voxa accessibility (axe) — public pages', () => {
  for (const { name, path } of PUBLIC_PAGES) {
    test(`${name} (${path}) has no WCAG 2.2 AA violations`, async ({ page }) => {
      const results = await analyzePage(page, path);
      expect(
        results.violations,
        JSON.stringify(formatViolations(results.violations), null, 2),
      ).toEqual([]);
    });
  }
});

/**
 * Authenticated surfaces, scanned WITHOUT credentials.
 *
 * These are the surfaces where the worst contrast failure in the app hid:
 * board-audit-panel and word-forms-panel both sit on #262626, where the old
 * muted gray measured 3.19:1. Nothing caught it, because the only authed lane
 * needed JANUA_TEST_* secrets and therefore skipped on every CI run.
 *
 * This lane runs everywhere the public lane does. It works because Voxa's
 * session cookie is unsigned JSON that `getSession()` reads with JSON.parse,
 * and because the CI a11y job runs the standalone server with no OIDC env at
 * all — see helpers/test-session.ts for the full argument. No auth code was
 * weakened to make this possible.
 */
test.describe('Voxa accessibility (axe) — authenticated surfaces (mock session)', () => {
  test('/app/edit editor grid has no WCAG 2.2 AA violations', async ({ page, context, baseURL }) => {
    await openAuthenticatedEditor(page, context, baseURL!);
    const results = await analyzeCurrentPage(page);
    expect(
      results.violations,
      JSON.stringify(formatViolations(results.violations), null, 2),
    ).toEqual([]);
  });

  test('board-audit-panel has no WCAG 2.2 AA violations', async ({ page, context, baseURL }) => {
    // The panel calls the Voxa API, which is not running in the a11y job.
    // Stub an empty audit list so the muted empty-state line renders — that
    // line is the exact node PR #4 fixed (3.19:1 muted on the #262626 ground).
    await page.route('**/v1/boards/**/audit**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [] }),
      }),
    );

    await openAuthenticatedEditor(page, context, baseURL!);
    await page.getByRole('button', { name: 'Audit' }).click();
    await page.getByRole('dialog', { name: 'Edit audit log' }).waitFor();
    await expect(page.getByText('No edit events yet.')).toBeVisible();
    const results = await analyzeCurrentPage(page);
    expect(
      results.violations,
      JSON.stringify(formatViolations(results.violations), null, 2),
    ).toEqual([]);
  });

  test('board-audit-panel error state has no WCAG 2.2 AA violations', async ({
    page,
    context,
    baseURL,
  }) => {
    // The error branch renders in a different color register (status.danger);
    // scan it too so a future palette change cannot regress it unseen.
    await page.route('**/v1/boards/**/audit**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Audit load failed (500)' }),
      }),
    );

    await openAuthenticatedEditor(page, context, baseURL!);
    await page.getByRole('button', { name: 'Audit' }).click();
    await page.getByRole('dialog', { name: 'Edit audit log' }).waitFor();
    await expect(page.getByText('Audit load failed (500)')).toBeVisible();
    const results = await analyzeCurrentPage(page);
    expect(
      results.violations,
      JSON.stringify(formatViolations(results.violations), null, 2),
    ).toEqual([]);
  });

  test('word-forms-panel has no WCAG 2.2 AA violations', async ({ page, context, baseURL }) => {
    await openAuthenticatedEditor(page, context, baseURL!);
    // Opening any grid button reveals the button editor, which hosts the panel.
    await page.getByRole('button', { name: 'I (locked motor-plan slot)' }).click();
    await expect(page.getByRole('heading', { name: 'Word forms' })).toBeVisible();
    // The exact node PR #4 fixed.
    await expect(page.getByText('No alternate forms yet.')).toBeVisible();
    const results = await analyzeCurrentPage(page);
    expect(
      results.violations,
      JSON.stringify(formatViolations(results.violations), null, 2),
    ).toEqual([]);
  });
});

/**
 * Full end-to-end authenticated lane against real Janua staging.
 *
 * Complements (does not replace) the mock-session lane above: this one
 * exercises the real OAuth round-trip, so it stays gated on the operator
 * secrets. Activates automatically once JANUA_TEST_EMAIL / JANUA_TEST_PASSWORD
 * (or VOXA_STAGING_TEST_EMAIL / VOXA_STAGING_TEST_PASSWORD) are present.
 */
test.describe('Voxa accessibility (axe) — authenticated communicator (real Janua)', () => {
  test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL and JANUA_TEST_PASSWORD');

  test('/app has no WCAG 2.2 AA violations after sign-in', async ({ page }) => {
    await prepareAuthenticatedApp(page);
    const results = await analyzeCurrentPage(page);
    expect(
      results.violations,
      JSON.stringify(formatViolations(results.violations), null, 2),
    ).toEqual([]);
  });

  test('/app settings dialog has no WCAG 2.2 AA violations', async ({ page }) => {
    await prepareAuthenticatedApp(page);
    await openAccessibilitySettings(page);
    const results = await analyzeCurrentPage(page);
    expect(
      results.violations,
      JSON.stringify(formatViolations(results.violations), null, 2),
    ).toEqual([]);
  });

  test('/app editor mode has no WCAG 2.2 AA violations', async ({ page }) => {
    await prepareAuthenticatedApp(page);
    await enterEditorMode(page);
    const results = await analyzeCurrentPage(page);
    expect(
      results.violations,
      JSON.stringify(formatViolations(results.violations), null, 2),
    ).toEqual([]);
  });
});
