/**
 * Voice choice and tuning, against the built web app with a stubbed
 * `speechSynthesis` (no API needed: the board comes from the offline cache).
 *
 * - A button press, «Hablar» (Speak) and a prediction chip all call `speak`
 *   with the chosen voice's `voiceURI`, the chosen rate/pitch/volume and
 *   `lang` = the board's speech locale (es-MX).
 * - Voices that arrive late without a `voiceschanged` event still list.
 * - With no voice for the board's language, the install guidance shows and
 *   Voxa still speaks.
 * - The Voice settings section has no WCAG 2.2 AA violations (axe) in a light
 *   and a dark theme.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { WCAG_TAGS, formatViolations } from '../helpers/a11y';
import { ui } from '../helpers/i18n';
import { seedLocalState, seedTestSession } from '../helpers/test-session';

// The standalone server in CI listens on 127.0.0.1; pin the UI language so
// every run takes the same `/app` -> `/en/app` route. The board itself is
// Spanish (es-MX), so speech is es-MX whatever the UI language.
test.use({ locale: 'en-US' });

/** Must match BOARD_CACHE_KEY / SELECTED_BOARD_KEY in apps/web/src/lib/communicator-settings.ts. */
const BOARD_CACHE_KEY = 'voxa-board-cache';
const SELECTED_BOARD_KEY = 'voxa-selected-board-id';
const SETTINGS_KEY = 'voxa-communicator-settings';
const BOARD_ID = 'e2e-voice-board';
const SPEECH_LOCALE = 'es-MX';

interface StubVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

const VOICES: StubVoice[] = [
  { voiceURI: 'test:samantha', name: 'Samantha', lang: 'en-US', localService: true, default: true },
  { voiceURI: 'test:monica', name: 'Mónica', lang: 'es-ES', localService: true, default: false },
  { voiceURI: 'test:paulina-enhanced', name: 'Paulina (Enhanced)', lang: 'es-MX', localService: true, default: false },
  { voiceURI: 'test:paulina', name: 'Paulina', lang: 'es-MX', localService: true, default: false },
  { voiceURI: 'test:thomas', name: 'Thomas', lang: 'fr-FR', localService: true, default: false },
];
const NO_SPANISH = VOICES.filter((v) => !v.lang.startsWith('es'));

interface Spoken {
  text: string;
  lang: string;
  voiceURI: string | null;
  rate: number;
  pitch: number;
  volume: number;
}

const button = (id: string, label: string, column: number, partOfSpeech?: string) => ({
  kind: 'analytic',
  id,
  label,
  speechText: label,
  locale: SPEECH_LOCALE,
  position: { row: 0, column },
  locked: false,
  ...(partOfSpeech ? { partOfSpeech } : {}),
});

const BOARD = {
  id: BOARD_ID,
  name: 'Voces E2E',
  profileId: 'default',
  version: 1,
  updatedAt: '2026-10-04T00:00:00.000Z',
  grid: {
    rows: 1,
    columns: 3,
    buttons: [button('yo', 'yo', 0, 'pronoun'), button('quiero', 'quiero', 1, 'verb'), button('agua', 'agua', 2, 'noun')],
  },
};

/**
 * Replace speech synthesis before the app loads. `mode` 'late-no-event'
 * returns no voices for the first calls and never fires `voiceschanged`.
 */
async function stubSpeech(
  page: Page,
  options: { voices: StubVoice[]; mode?: 'ready' | 'late-no-event'; settings?: Record<string, unknown> },
): Promise<void> {
  await seedLocalState(page);
  await page.addInitScript(
    ({ voices, mode, board, cacheKey, selectedKey, settingsKey, settings }) => {
      localStorage.setItem(cacheKey, JSON.stringify(board));
      localStorage.setItem(selectedKey, board.id);
      // Seed settings once: a reload must keep what the app saved since.
      if (settings && localStorage.getItem(settingsKey) === null) {
        localStorage.setItem(settingsKey, JSON.stringify(settings));
      }

      const spoken: unknown[] = [];
      (window as unknown as { __voxaSpoken: unknown[] }).__voxaSpoken = spoken;
      let calls = 0;
      const target = new EventTarget();
      const synth = {
        speaking: false,
        pending: false,
        paused: false,
        getVoices: () => {
          calls += 1;
          return mode === 'late-no-event' && calls < 4 ? [] : voices;
        },
        speak: (u: {
          text: string;
          lang: string;
          voice: { voiceURI: string } | null;
          rate: number;
          pitch: number;
          volume: number;
          onend?: (() => void) | null;
        }) => {
          spoken.push({
            text: u.text,
            lang: u.lang,
            voiceURI: u.voice?.voiceURI ?? null,
            rate: u.rate,
            pitch: u.pitch,
            volume: u.volume,
          });
          setTimeout(() => u.onend?.(), 0);
        },
        cancel: () => undefined,
        pause: () => undefined,
        resume: () => undefined,
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
        dispatchEvent: target.dispatchEvent.bind(target),
      };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
      // A real SpeechSynthesisUtterance only accepts a real SpeechSynthesisVoice.
      class StubUtterance {
        text: string;
        lang = '';
        voice: unknown = null;
        rate = 1;
        pitch = 1;
        volume = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: StubUtterance });
    },
    {
      voices: options.voices,
      mode: options.mode ?? 'ready',
      board: BOARD,
      cacheKey: `${BOARD_CACHE_KEY}:${BOARD_ID}`,
      selectedKey: SELECTED_BOARD_KEY,
      settingsKey: SETTINGS_KEY,
      settings: options.settings,
    },
  );
}

async function openApp(page: Page): Promise<void> {
  // /app is gated on a valid session (the CI server has sign-in configured).
  await seedTestSession(page.context(), process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000', {
    role: 'communicator',
  });
  await page.goto('/app');
  await expect(page.locator('[data-voxa-button-id="yo"]')).toBeVisible({ timeout: 30_000 });
}

async function openVoiceSettings(page: Page) {
  await page.getByRole('button', { name: ui('common.settings') }).click();
  await page.getByRole('dialog', { name: ui('settings.title') }).waitFor();
  const section = page.locator('[data-voxa-voice-settings]');
  await expect(section).toBeVisible();
  return section;
}

async function spoken(page: Page): Promise<Spoken[]> {
  return page.evaluate(() => (window as unknown as { __voxaSpoken: Spoken[] }).__voxaSpoken);
}

/** Run `action` and return the first utterance it speaks. */
async function speakAfter(page: Page, action: () => Promise<void>): Promise<Spoken> {
  const before = (await spoken(page)).length;
  await action();
  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(before);
  return (await spoken(page))[before]!;
}

async function lastSpoken(page: Page, expectedText?: RegExp): Promise<Spoken> {
  await expect
    .poll(async () => {
      const all = await spoken(page);
      const last = all[all.length - 1];
      return last && (!expectedText || expectedText.test(last.text)) ? last.text : null;
    })
    .not.toBeNull();
  const all = await spoken(page);
  return all[all.length - 1]!;
}

test.describe('Voice choice and tuning', () => {
  test('button press, Speak and a prediction chip use the chosen voice, tuning and the board locale', async ({ page }) => {
    await stubSpeech(page, { voices: VOICES });
    await openApp(page);

    const section = await openVoiceSettings(page);
    const select = section.locator('select');
    // es-MX voices are listed first; other languages stay behind "show all".
    const exactGroup = select.locator('optgroup').first();
    await expect(exactGroup.locator('option')).toHaveText([/Paulina \(Enhanced\)/, /^Paulina \(es-MX\)$/]);
    await expect(select.locator('option[value="test:samantha"]')).toHaveCount(0);
    await section.getByRole('checkbox').check();
    await expect(select.locator('option[value="test:samantha"]')).toHaveCount(1);

    // Choose the plain es-MX voice (not the one ranking would pick).
    await select.selectOption('test:paulina');

    // "Higher voice (approximation)" preset: pitch 1.6, rate 1.1.
    await section.getByRole('button', { name: ui('voice.higherPreset') }).click();
    const sliders = section.getByRole('slider');
    await expect(sliders).toHaveCount(3);
    // Keyboard steps of 0.1: rate 1.1 -> 1.3, volume 1 -> 0.7.
    await sliders.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await sliders.nth(2).focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    // Visible values (English UI in this run).
    await expect(section).toContainText('Rate: 1.3');
    await expect(section).toContainText('Pitch: 1.6');
    await expect(section).toContainText('Volume: 70%');

    // Preview speaks with the edited voice and tuning.
    await section.getByRole('button', { name: ui('voice.preview') }).click();
    const preview = await lastSpoken(page);
    expect(preview).toMatchObject({ voiceURI: 'test:paulina', lang: SPEECH_LOCALE });

    await page.getByRole('dialog', { name: ui('settings.title') }).getByRole('button', { name: ui('common.close') }).click();

    const expected = { voiceURI: 'test:paulina', rate: 1.3, pitch: 1.6, volume: 0.7, lang: SPEECH_LOCALE };

    // 1. A button press.
    const pressed = await speakAfter(page, () => page.locator('[data-voxa-button-id="yo"]').click());
    expect(pressed).toEqual({ text: 'yo', ...expected });

    // 2. «Hablar» / Speak: the whole message.
    const message = await speakAfter(page, () => page.getByRole('button', { name: ui('common.speak') }).click());
    expect(message).toEqual({ text: 'yo', ...expected });

    // 3. A prediction chip (local predictor: "yo" -> "yo quiero" …).
    const suggestions = page.getByRole('region', { name: ui('communicator.suggestionsAria') });
    const chip = suggestions.getByRole('button', { name: /^yo quiero$/i });
    await expect(chip).toBeVisible();
    const suggestion = await speakAfter(page, () => chip.click());
    expect(suggestion).toEqual({ text: 'yo quiero', ...expected });

    // The choice is remembered on this device.
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), SETTINGS_KEY);
    expect(stored).toMatchObject({
      voiceURIByLocale: { [SPEECH_LOCALE]: 'test:paulina' },
      speechRate: 1.3,
      speechPitch: 1.6,
      speechVolume: 0.7,
    });
  });

  test('voices that load late without voiceschanged are still listed and used', async ({ page }) => {
    await stubSpeech(page, { voices: VOICES, mode: 'late-no-event' });
    await openApp(page);
    const section = await openVoiceSettings(page);
    await expect(section.locator('option[value="test:paulina-enhanced"]')).toHaveCount(1);
    await page.getByRole('dialog', { name: ui('settings.title') }).getByRole('button', { name: ui('common.close') }).click();
    await page.locator('[data-voxa-button-id="agua"]').click();
    // No choice stored: the best es-MX voice by name hint.
    expect(await lastSpoken(page, /^agua$/)).toMatchObject({ voiceURI: 'test:paulina-enhanced', lang: SPEECH_LOCALE });
  });

  test('a stored voice that is gone falls back to the best match and says so once', async ({ page }) => {
    await stubSpeech(page, {
      voices: VOICES,
      settings: { voiceURIByLocale: { [SPEECH_LOCALE]: 'test:removed-by-os-update' } },
    });
    await openApp(page);
    const notice = page.locator('[data-voxa-voice-missing]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Paulina (Enhanced)');
    await page.locator('[data-voxa-button-id="agua"]').click();
    expect(await lastSpoken(page, /^agua$/)).toMatchObject({ voiceURI: 'test:paulina-enhanced', lang: SPEECH_LOCALE });
    await notice.getByRole('button', { name: ui('voice.dismiss') }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-voxa-button-id="yo"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-voxa-voice-missing]')).toHaveCount(0);
  });

  test('with no Spanish voice, install guidance shows and Voxa still speaks', async ({ page }) => {
    await stubSpeech(page, { voices: NO_SPANISH });
    await openApp(page);
    const section = await openVoiceSettings(page);
    const help = section.locator('[data-voxa-voice-install-help]');
    await expect(help).toBeVisible();
    await expect(help.locator('li')).toHaveCount(3);
    await page.getByRole('dialog', { name: ui('settings.title') }).getByRole('button', { name: ui('common.close') }).click();
    await page.locator('[data-voxa-button-id="agua"]').click();
    expect(await lastSpoken(page, /^agua$/)).toMatchObject({ lang: SPEECH_LOCALE, voiceURI: null });
  });

  for (const { theme, colorScheme } of [
    { theme: 'classic-light', colorScheme: 'light' },
    { theme: 'cvi-dark', colorScheme: 'dark' },
  ] as const) {
    test(`the Voice settings section has no WCAG 2.2 AA violations (${theme}, ${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await stubSpeech(page, { voices: NO_SPANISH.concat(VOICES.filter((v) => v.lang === 'es-MX')), settings: { cviTheme: theme } });
      await openApp(page);
      const section = await openVoiceSettings(page);
      await section.getByRole('checkbox').check();
      const results = await new AxeBuilder({ page })
        .include('[data-voxa-voice-settings]')
        .withTags([...WCAG_TAGS])
        .analyze();
      expect(results.violations, JSON.stringify(formatViolations(results.violations), null, 2)).toEqual([]);
    });

    test(`the install guidance has no WCAG 2.2 AA violations (${theme}, ${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await stubSpeech(page, { voices: NO_SPANISH, settings: { cviTheme: theme } });
      await openApp(page);
      await openVoiceSettings(page);
      await expect(page.locator('[data-voxa-voice-install-help]')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .include('[data-voxa-voice-settings]')
        .withTags([...WCAG_TAGS])
        .analyze();
      expect(results.violations, JSON.stringify(formatViolations(results.violations), null, 2)).toEqual([]);
    });
  }
});
