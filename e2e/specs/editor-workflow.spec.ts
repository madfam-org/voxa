import { test, expect } from '@playwright/test';
import { hasJanuaTestCredentials } from '../helpers/janua-login';
import {
  createBoardNamed,
  enterCommunicatorMode,
  enterEditorMode,
  exportObfText,
  prepareAuthenticatedApp,
} from '../helpers/app-session';

test.describe('Editor workflow (W2)', () => {
  test('SLP creates three boards and exports each as OBF', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await enterEditorMode(page);

    const stamp = Date.now();
    const names = [`W2-${stamp}-A`, `W2-${stamp}-B`, `W2-${stamp}-C`];

    for (const name of names) {
      await createBoardNamed(page, name);
    }

    const exports: string[] = [];
    for (const name of names) {
      await page.getByLabel('Board').selectOption({ label: name });
      await expect(page.getByLabel('Board')).toHaveValue(/.+/);
      const obf = await exportObfText(page);
      expect(obf).toContain('open-board-format');
      expect(obf).toContain(name);
      exports.push(obf);
    }

    expect(new Set(exports).size).toBe(3);
  });

  test('locked core words stay fixed after fringe edits', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await enterEditorMode(page);

    await page.getByRole('button', { name: /^eat$/ }).click();
    await page.getByLabel('Speech').fill('snack time');
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('button', { name: /want \(locked motor-plan slot\)/ })).toBeVisible();

    const obf = await exportObfText(page);
    expect(obf).toContain('snack time');
    expect(obf).toContain('"vocalization": "want"');
    expect(obf).toContain('"label": "want"');
  });

  test('babble reveals hidden buttons for one session then resets', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD');

    await prepareAuthenticatedApp(page);
    await enterEditorMode(page);

    await page.getByRole('button', { name: /^home$/ }).click();
    await page.getByRole('checkbox', { name: 'Hide from communicator view' }).check();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Save' }).click();

    await enterCommunicatorMode(page);
    await expect(page.getByRole('button', { name: /^home$/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Babble' }).click();
    await expect(page.getByRole('button', { name: /home \(hidden, babble mode\)/ })).toBeVisible();

    await page.getByRole('button', { name: 'Babble' }).click();
    await expect(page.getByRole('button', { name: /^home$/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Babble' }).click();
    await page.getByLabel('Board').selectOption({ label: /Core 47 Starter/ });
    await expect(page.getByRole('button', { name: /home \(hidden, babble mode\)/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^home$/ })).toHaveCount(0);
  });
});
