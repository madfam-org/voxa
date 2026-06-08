import { test, expect } from '@playwright/test';
import { analyzePage, analyzeCurrentPage, formatViolations } from '../helpers/a11y';
import { hasJanuaTestCredentials } from '../helpers/janua-login';
import {
  enterEditorMode,
  openAccessibilitySettings,
  prepareAuthenticatedApp,
} from '../helpers/app-session';

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

test.describe('Voxa accessibility (axe) — authenticated communicator', () => {
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
