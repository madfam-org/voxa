import { test, expect } from '@playwright/test';

test.describe('Voxa GA smoke', () => {
  test('landing page loads with demo CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('voice');
    await expect(page.getByRole('link', { name: /Try the live demo/i })).toBeVisible();
  });

  test('demo page loads communication board', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByRole('tablist', { name: 'Demo scenes' })).toBeVisible();
    await expect(page.getByRole('grid', { name: 'Communication board' })).toBeVisible();
  });

  test('legal privacy page is reachable', async ({ page }) => {
    await page.goto('/legal/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('accessibility statement is reachable', async ({ page }) => {
    await page.goto('/legal/accessibility');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
