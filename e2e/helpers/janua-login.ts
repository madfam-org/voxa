import { type Page, expect } from '@playwright/test';
import { ui } from './i18n';

const STAGING_EMAIL = process.env.JANUA_TEST_EMAIL ?? process.env.VOXA_STAGING_TEST_EMAIL;
const STAGING_PASSWORD =
  process.env.JANUA_TEST_PASSWORD ?? process.env.VOXA_STAGING_TEST_PASSWORD;

export function hasJanuaTestCredentials(): boolean {
  return Boolean(STAGING_EMAIL && STAGING_PASSWORD);
}

/** Complete Janua OAuth through the Voxa staging sign-in flow. */
export async function signInViaJanua(page: Page): Promise<void> {
  if (!STAGING_EMAIL || !STAGING_PASSWORD) {
    throw new Error('Janua test credentials not configured');
  }

  await page.goto('/auth/signin');
  await page.getByRole('button', { name: ui('auth.continueJanua') }).click();
  await page.waitForURL(/auth\.madfam\.io/);
  await page.getByRole('textbox', { name: 'Email' }).fill(STAGING_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(STAGING_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  const allowButton = page.getByRole('button', { name: 'Allow' });
  if (await allowButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await allowButton.click();
  }

  await page.waitForURL(/voxa-staging\.madfam\.io/, { timeout: 30000 });
  if (page.url().includes('/auth/signin')) {
    throw new Error(`Janua sign-in failed: still on ${page.url()}`);
  }

  // Auth.js answers /api/auth/session with 200 and `null` when signed out:
  // check that it names a user (identity and role only, never a token).
  const session = await page.request.get('/api/auth/session');
  const body = (await session.json().catch(() => null)) as { user?: { id?: string } } | null;
  if (!session.ok() || !body?.user?.id) {
    throw new Error(`Session not established (${session.status()})`);
  }

  await page.goto('/app');
  await expect(page.getByRole('button', { name: ui('common.settings') })).toBeVisible({ timeout: 20000 });
}
