import { test, expect } from '@playwright/test';
import { hasJanuaTestCredentials, signInViaJanua } from '../helpers/janua-login';

test.describe('Staging UX soak', () => {
  test('sign-in page loads Continue with Janua', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByRole('button', { name: 'Continue with Janua' })).toBeVisible();
  });

  test('AI consent banner can be dismissed on sign-in', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('voxa-ai-consent'));
    await page.goto('/auth/signin');
    const dialog = page.getByRole('dialog', { name: 'Privacy choices' });
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Essential only' }).click();
    await expect(dialog).toBeHidden();
  });

  test('legal pages are reachable without auth', async ({ page }) => {
    await page.goto('/legal/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/legal/accessibility');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('accessibility settings expose CVI theme and switch scanning', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD for staging OAuth');

    await page.addInitScript(() => localStorage.setItem('voxa-ai-consent', 'granted'));
    await signInViaJanua(page);

    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Accessibility settings' })).toBeVisible();
    await page.getByLabel('Visual theme (CVI)').selectOption('cvi-high-contrast');
    await page.getByLabel('Access method').selectOption('switch');
    await expect(page.getByLabel('Scan speed')).toBeVisible();
  });
});
