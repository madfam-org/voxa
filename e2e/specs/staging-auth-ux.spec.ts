import { test, expect } from '@playwright/test';
import { hasJanuaTestCredentials, signInViaJanua } from '../helpers/janua-login';

test.describe('Staging authenticated UX soak', () => {
  test('sign-out clears session and API returns 401', async ({ page, request }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');
    test.skip(!!process.env.CI, 'Browser Janua OAuth — run manually on staging (API auth soak covers CI)');

    await page.addInitScript(() => localStorage.setItem('voxa-ai-consent', 'granted'));
    await signInViaJanua(page);

    const sessionBefore = await page.request.get('/api/auth/session');
    expect(sessionBefore.ok()).toBeTruthy();

    await page.goto('/auth/signout');
    await page.waitForURL(/voxa-staging\.madfam\.io/);

    const sessionAfter = await page.request.get('/api/auth/session');
    expect(sessionAfter.status()).toBe(401);

    const apiBase =
      process.env.VOXA_STAGING_API_URL ?? 'https://voxa-api-staging.madfam.io';
    const boards = await request.get(`${apiBase}/v1/boards`);
    expect(boards.status()).toBe(401);
  });
});
