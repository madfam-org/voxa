import { type Page, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { signInViaJanua } from './janua-login';

/** Seed local consent/editor state before navigation. */
export async function prepareAuthenticatedApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('voxa-ai-consent', 'granted');
    localStorage.removeItem('voxa-editor-pin');
    sessionStorage.removeItem('voxa-editor-unlocked');
  });
  await signInViaJanua(page);
}

export async function openAccessibilitySettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog', { name: 'Accessibility settings' }).waitFor();
}

export async function enterEditorMode(page: Page): Promise<void> {
  await page.getByLabel('Team role').selectOption('editor');
  await page.getByRole('button', { name: 'New board' }).waitFor();
}

export async function enterCommunicatorMode(page: Page): Promise<void> {
  await page.getByLabel('Team role').selectOption('communicator');
  await page.getByRole('button', { name: 'Babble' }).waitFor();
}

export async function createBoardNamed(page: Page, name: string): Promise<void> {
  page.once('dialog', async (dialog) => {
    await dialog.accept(name);
  });
  await page.getByRole('button', { name: 'New board' }).click();
  await expect(page.getByLabel('Board')).toHaveText(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

export async function exportObfText(page: Page): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export OBF' }).click();
  const file = await downloadPromise;
  const path = await file.path();
  if (!path) throw new Error('OBF download missing path');
  return readFile(path, 'utf8');
}

export async function openButtonEditor(page: Page, name: RegExp | string): Promise<void> {
  await page.getByRole('button', { name }).click();
  await expect(page.getByRole('heading', { name: 'Edit button' })).toBeVisible();
}

export async function saveBoardAndWait(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Live v\d+/)).toBeVisible({ timeout: 20000 });
}

export async function exportObzPath(page: Page): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export OBZ' }).click();
  const file = await downloadPromise;
  const path = await file.path();
  if (!path) throw new Error('OBZ download missing path');
  return path;
}

export async function openUsageReport(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Usage' }).click();
  await expect(page.getByRole('dialog', { name: 'Usage report' })).toBeVisible();
}

export async function openAuditLog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Audit' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit audit log' })).toBeVisible();
}
