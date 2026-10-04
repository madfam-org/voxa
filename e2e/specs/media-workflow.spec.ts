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

// The symbol panel follows the UI language (es default, en, fr).
const SEARCH_PLACEHOLDER = /Buscar símbolos|Search symbols|Rechercher des symboles/;
const SEARCH_BUTTON = /^(Buscar|Search|Rechercher)$/;
const REMOVE_SYMBOL = /Quitar símbolo|Remove symbol|Retirer le symbole/;
const UPLOAD_PHOTO = /Subir foto|Upload photo|Importer une photo/;

test.describe('Media workflow (W2 Epic C)', () => {
  test('editor attaches a Mulberry symbol from search', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await enterEditorMode(page);
    await openButtonEditor(page, /^eat$/);

    await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill('comer');
    await page.getByRole('button', { name: SEARCH_BUTTON }).click();
    const firstHit = page.locator('[data-voxa-symbol-results] button img').first();
    await expect(firstHit).toBeVisible({ timeout: 20000 });
    await expect(firstHit).toHaveAttribute('src', /^\/symbols\/mulberry\//);
    await expect(page.locator('[data-voxa-symbol-credit="mulberry"]').first()).toContainText('CC BY-SA 4.0');
    await firstHit.click();

    await expect(page.getByRole('button', { name: REMOVE_SYMBOL })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await saveBoardAndWait(page);

    const obf = await exportObfText(page);
    expect(obf).toMatch(/"image_id"/);
    expect(obf).toMatch(/symbols\/mulberry\//);
    expect(obf).toMatch(/"type": "CC BY-SA 4\.0"/);
    expect(obf).not.toMatch(/arasaac/i);
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
    await page.getByRole('button', { name: UPLOAD_PHOTO }).click();
    (await fileChooser).setFiles(SYMBOL_FIXTURE);
    await expect(page.getByRole('button', { name: REMOVE_SYMBOL })).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await saveBoardAndWait(page);

    const obzPath = await exportObzPath(page);

    await openButtonEditor(page, /^eat$/);
    await page.getByRole('button', { name: REMOVE_SYMBOL }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await saveBoardAndWait(page);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import OBZ' }).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles(obzPath);
    await expect(page.getByText(/Live v\d+/)).toBeVisible({ timeout: 20000 });

    await openButtonEditor(page, /^eat$/);
    await expect(page.getByRole('button', { name: REMOVE_SYMBOL })).toBeVisible({ timeout: 20000 });
  });
});
