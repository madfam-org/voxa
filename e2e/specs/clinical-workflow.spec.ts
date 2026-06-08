import { test, expect } from '@playwright/test';
import { hasJanuaTestCredentials } from '../helpers/janua-login';
import {
  enterCommunicatorMode,
  enterEditorMode,
  openAccessibilitySettings,
  openAuditLog,
  openUsageReport,
  prepareAuthenticatedApp,
  saveBoardAndWait,
} from '../helpers/app-session';

test.describe('Clinical workflow (W3 Epic E)', () => {
  test('SLP usage report shows activation counts with consent', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await enterCommunicatorMode(page);

    const activation = page.waitForResponse(
      (response) =>
        response.url().includes('/v1/events/activations') &&
        response.request().method() === 'POST' &&
        response.status() === 201,
      { timeout: 20000 },
    );
    await page.getByRole('button', { name: /^want$/ }).click();
    await activation;

    await enterEditorMode(page);
    await openUsageReport(page);
    await expect(page.getByText(/\d+ activation/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('cell', { name: 'want' })).toBeVisible();
  });

  test('remote SLP editor loads at /app/edit for clinician accounts', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await page.goto('/app/edit');
    await expect(page.getByText('Remote SLP editor')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Audit' })).toBeVisible();
  });

  test('edit audit log records vocabulary saves', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await enterEditorMode(page);

    await openAccessibilitySettings(page);
    const hideLabels = page.getByLabel('Hide labels on this board');
    if (await hideLabels.isVisible()) {
      await hideLabels.check();
    } else {
      await page.getByLabel('Symbol-only mode (hide labels)').check();
    }
    await page.getByRole('button', { name: 'Close' }).click();
    await saveBoardAndWait(page);

    await openAuditLog(page);
    await expect(page.getByText(/Saved vocabulary \(v\d+\)/)).toBeVisible({ timeout: 15000 });
  });
});
