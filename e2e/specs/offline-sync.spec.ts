import { test, expect } from '@playwright/test';
import { hasJanuaTestCredentials } from '../helpers/janua-login';
import {
  enterEditorMode,
  openAccessibilitySettings,
  prepareAuthenticatedApp,
} from '../helpers/app-session';

const API_BASE = process.env.VOXA_STAGING_API_URL ?? 'https://voxa-api-staging.madfam.io';

test.describe('Offline sync soak', () => {
  test('editor queues board save when API PUT fails, then retries when online', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    let blockSave = true;
    await page.route(`${API_BASE}/v1/boards/**`, async (route) => {
      if (blockSave && route.request().method() === 'PUT') {
        await route.fulfill({ status: 503, body: 'staging offline soak' });
        return;
      }
      await route.continue();
    });

    await prepareAuthenticatedApp(page);
    await enterEditorMode(page);

    await openAccessibilitySettings(page);
    const boardHideSymbols = page.getByLabel('Hide symbols on this board');
    await expect(boardHideSymbols).toBeVisible();
    await boardHideSymbols.check();
    await page.getByRole('button', { name: 'Close' }).click();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toMatch(/queued|offline/i);
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Save' }).click();

    const banner = page.getByRole('status');
    await expect(banner).toContainText(/queued|sync when back online/i, { timeout: 10000 });

    const pendingKey = await page.evaluate(() => {
      return Object.keys(localStorage).find((key) => key.startsWith('voxa-pending-board-save:'));
    });
    expect(pendingKey).toBeTruthy();

    blockSave = false;
    await page.getByRole('button', { name: 'Retry sync' }).click();
    await expect(banner).toBeHidden({ timeout: 15000 });
  });

  test('editor role blocks drag onto locked motor-plan slots', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await page.getByLabel('Team role').selectOption('editor');
    await enterEditorMode(page);

    const dialogPromise = new Promise<string>((resolve) => {
      page.once('dialog', async (dialog) => {
        resolve(dialog.message());
        await dialog.accept();
      });
    });

    await page
      .getByRole('button', { name: /want \(locked motor-plan slot\)/ })
      .dragTo(page.getByRole('button', { name: /go \(locked motor-plan slot\)/ }));

    await expect.poll(() => dialogPromise).toContain('locked');
  });

  test('communicator mode does not expose draggable editor cells', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await page.getByLabel('Team role').selectOption('communicator');

    const want = page.getByRole('button', { name: /^want$/ }).first();
    await expect(want).toBeVisible();
    await expect(want).not.toHaveAttribute('draggable');
  });
});
