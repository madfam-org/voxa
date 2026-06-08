import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { hasJanuaTestCredentials } from '../helpers/janua-login';
import {
  enterCommunicatorMode,
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

  test('edit, speak, and OBF export survive offline queue then online sync', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    const marker = `offline-soak-${Date.now()}`;
    let blockWrite = true;
    let blockExport = true;

    await page.route(`${API_BASE}/v1/boards/**`, async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      if (blockWrite && method === 'PUT') {
        await route.fulfill({ status: 503, body: 'offline soak' });
        return;
      }
      if (blockExport && method === 'GET' && url.includes('/export/obf')) {
        await route.fulfill({ status: 503, body: 'offline soak' });
        return;
      }
      await route.continue();
    });

    await prepareAuthenticatedApp(page);
    await enterEditorMode(page);

    await page.getByRole('button', { name: /^eat$/ }).click();
    await page.getByLabel('Speech').fill(marker);
    await page.getByRole('button', { name: 'Done' }).click();

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText(/queued|sync when back online/i, {
      timeout: 10000,
    });

    await enterCommunicatorMode(page);
    await page.getByRole('button', { name: /^I$/ }).click();
    await page.getByRole('button', { name: /^want$/ }).click();
    await expect(page.getByText('I want')).toBeVisible();

    await enterEditorMode(page);
    const offlineDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export OBF' }).click();
    const offlineFile = await offlineDownload;
    const offlinePath = await offlineFile.path();
    expect(offlinePath).toBeTruthy();
    const offlineObf = await readFile(offlinePath!, 'utf8');
    expect(offlineObf).toContain(marker);

    blockWrite = false;
    await page.getByRole('button', { name: 'Retry sync' }).click();
    await expect(page.getByRole('status')).toBeHidden({ timeout: 15000 });

    blockExport = false;
    const onlineDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export OBF' }).click();
    const onlineFile = await onlineDownload;
    const onlinePath = await onlineFile.path();
    expect(onlinePath).toBeTruthy();
    const onlineObf = await readFile(onlinePath!, 'utf8');
    expect(onlineObf).toContain(marker);
  });
});
