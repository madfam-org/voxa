import { test, expect } from '@playwright/test';

test.describe('Voxa GA smoke', () => {
  test('home loads communicator UI', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('main')).toBeVisible();
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
