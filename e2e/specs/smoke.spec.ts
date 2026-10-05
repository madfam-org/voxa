import { test, expect } from '@playwright/test';
import { ui } from '../helpers/i18n';

// Runs daily against production (e2e-smoke.yml). Public pages render in
// Spanish by default (unprefixed URLs) and the browser's language can change
// that, so every catalog-backed name is matched in any locale with `ui()`,
// never as an English string (an English-only selector failed the daily smoke
// on 2026-10-02 and 2026-10-03).
test.describe('Voxa GA smoke', () => {
  test('landing page loads with demo CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ui('landing.heroTitle'));
    await expect(page.getByRole('link', { name: ui('landing.tryDemo') }).first()).toBeVisible();
  });

  test('demo page loads communication board', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByRole('tablist', { name: ui('demo.scenesAriaLabel') })).toBeVisible();
    await expect(page.getByRole('grid', { name: ui('board.gridLabel') })).toBeVisible();
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
