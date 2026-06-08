import { test, expect } from '@playwright/test';
import { analyzePage, formatViolations } from '../helpers/a11y';
import { hasJanuaTestCredentials, signInViaJanua } from '../helpers/janua-login';

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
    await signInViaJanua(page);
    const results = await analyzePage(page, '/app');
    expect(
      results.violations,
      JSON.stringify(formatViolations(results.violations), null, 2),
    ).toEqual([]);
  });
});
