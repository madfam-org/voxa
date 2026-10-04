import { test, expect } from '@playwright/test';
import { ui } from '../helpers/i18n';
import { hasJanuaTestCredentials, signInViaJanua } from '../helpers/janua-login';

test.describe('Staging authenticated UX soak', () => {
  test('sign-out ends the session and the proxy then answers 401', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await signInViaJanua(page);

    const sessionBefore = await page.request.get('/api/auth/session');
    expect(((await sessionBefore.json()) as { user?: { id?: string } } | null)?.user?.id).toBeTruthy();

    // Sign-out is a POST form; GET answers 405.
    expect((await page.request.get('/auth/signout', { maxRedirects: 0 })).status()).toBe(405);
    await page.getByRole('button', { name: ui('auth.signOut') }).click();
    await page.waitForURL(/\/auth\/signin/, { timeout: 30_000 });

    const sessionAfter = await page.request.get('/api/auth/session');
    expect(await sessionAfter.json()).toBeNull();
    const boards = await page.request.get('/api/v1/boards');
    expect(boards.status()).toBe(401);
  });
});
