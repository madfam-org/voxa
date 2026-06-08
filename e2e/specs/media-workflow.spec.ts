import path from 'node:path';
import { test, expect } from '@playwright/test';
import { hasJanuaTestCredentials } from '../helpers/janua-login';
import {
  enterCommunicatorMode,
  enterEditorMode,
  exportObfText,
  exportObzPath,
  openButtonEditor,
  prepareAuthenticatedApp,
  saveBoardAndWait,
} from '../helpers/app-session';

const FIXTURES = path.join(process.cwd(), 'fixtures');
const SYMBOL_FIXTURE = path.join(FIXTURES, 'test-symbol.png');
const AUDIO_FIXTURE = path.join(FIXTURES, 'test-recording.wav');

test.describe('Media workflow (W2 Epic C)', () => {
  test('editor attaches ARASAAC symbol from search', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await enterEditorMode(page);
    await openButtonEditor(page, /^eat$/);

    await page.getByPlaceholder('Search symbols…').fill('eat');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('button[title] img').first()).toBeVisible({ timeout: 20000 });
    await page.locator('button[title] img').first().click();

    await expect(page.getByRole('button', { name: 'Remove symbol' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await saveBoardAndWait(page);

    const obf = await exportObfText(page);
    expect(obf).toMatch(/image_id|symbolUrl|arasaac|static\.arasaac/i);
  });

  test('GLP button plays uploaded caregiver audio in communicator', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await enterEditorMode(page);
    await openButtonEditor(page, /^Yay!$/);

    await page.getByText('Upload audio').locator('..').locator('input[type="file"]').setInputFiles(AUDIO_FIXTURE);
    await expect(page.getByText('Audio attached')).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await saveBoardAndWait(page);

    await enterCommunicatorMode(page);
    const mediaRequest = page.waitForResponse(
      (response) => response.url().includes('/v1/media/') && response.ok(),
      { timeout: 20000 },
    );
    await page.getByRole('button', { name: /^Yay!$/ }).click();
    await mediaRequest;
  });

  test('OBZ export and re-import preserves embedded symbol image', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await enterEditorMode(page);
    await openButtonEditor(page, /^eat$/);

    const fileChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Upload photo/ }).click();
    (await fileChooser).setFiles(SYMBOL_FIXTURE);
    await expect(page.getByRole('button', { name: 'Remove symbol' })).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await saveBoardAndWait(page);

    const obzPath = await exportObzPath(page);

    await openButtonEditor(page, /^eat$/);
    await page.getByRole('button', { name: 'Remove symbol' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await saveBoardAndWait(page);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import OBZ' }).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles(obzPath);
    await expect(page.getByText(/Live v\d+/)).toBeVisible({ timeout: 20000 });

    await openButtonEditor(page, /^eat$/);
    await expect(page.getByRole('button', { name: 'Remove symbol' })).toBeVisible({ timeout: 20000 });
  });
});
