import { type Page } from '@playwright/test';
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
