import { test, expect } from '@playwright/test';
import { hasJanuaTestCredentials } from '../helpers/janua-login';
import { openAccessibilitySettings, prepareAuthenticatedApp } from '../helpers/app-session';

test.describe('Staging UX soak', () => {
  test('sign-in page loads Continue with Janua', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByRole('button', { name: 'Continue with Janua' })).toBeVisible();
  });

  test('AI consent banner can be dismissed on sign-in', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('voxa-ai-consent'));
    await page.goto('/auth/signin');
    const dialog = page.getByRole('dialog', { name: 'Privacy choices' });
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Essential only' }).click();
    await expect(dialog).toBeHidden();
  });

  test('legal pages are reachable without auth', async ({ page }) => {
    await page.goto('/legal/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/legal/accessibility');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('accessibility settings expose CVI theme and switch scanning', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD for staging OAuth');

    await prepareAuthenticatedApp(page);

    await openAccessibilitySettings(page);
    await page.getByLabel('Visual theme (CVI)').selectOption('cvi-high-contrast');
    await page.getByLabel('Access method').selectOption('switch');
    await expect(page.getByLabel('Scan speed')).toBeVisible();
  });

  test('switch scan announces focused button and advances with ArrowRight', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD for staging OAuth');

    await page.addInitScript(() => {
      localStorage.setItem('voxa-ai-consent', 'granted');
      localStorage.removeItem('voxa-editor-pin');
      localStorage.setItem(
        'voxa-communicator-settings',
        JSON.stringify({
          accessMode: 'switch',
          cviTheme: 'cvi-dark',
          targetScale: 1.2,
          switchIntervalMs: 10000,
          switchOrder: 'row-major',
          eyeDwellMs: 1000,
          auditoryScanHighlight: true,
          auditoryScanVoice: false,
          pauseScanWhileSpeaking: true,
          touchActivation: 'press',
          whisperMode: false,
          hideSymbols: false,
          hideLabels: false,
        }),
      );
    });
    await prepareAuthenticatedApp(page);

    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toBeAttached();
    await expect(liveRegion).not.toHaveText('', { timeout: 5000 });

    const firstLabel = (await liveRegion.textContent())?.trim() ?? '';
    expect(firstLabel.length).toBeGreaterThan(0);

    await page.keyboard.press('ArrowRight');
    await expect(liveRegion).not.toHaveText(firstLabel, { timeout: 5000 });
  });

  test('auditory scan voice toggle is available in settings', async ({ page }) => {
    test.skip(!hasJanuaTestCredentials(), 'Requires JANUA_TEST_EMAIL/PASSWORD for staging OAuth');

    await prepareAuthenticatedApp(page);
    await openAccessibilitySettings(page);
    await page.getByLabel('Access method').selectOption('switch');
    const voiceToggle = page.getByRole('checkbox', { name: 'Speak scanned label aloud' });
    await expect(voiceToggle).toBeVisible();
    await voiceToggle.check();
    await expect(voiceToggle).toBeChecked();
  });
});
