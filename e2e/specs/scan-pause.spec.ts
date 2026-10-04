/**
 * Switch scanning resumes after speech even when the speech engine never
 * says it finished (C-029). Against the built web app with a stubbed
 * `speechSynthesis` that reports `speaking` forever and never fires `end` or
 * `error` (what some Android and iOS voices, and backgrounded pages, do). No
 * API needed: the board comes from the offline cache.
 *
 * - Selecting a button with the switch (Space) speaks it and pauses the scan.
 * - The scan stays paused while the utterance could still be playing.
 * - It moves again on its own once the bound for that utterance passes
 *   (2 s for a one-word message), not never.
 * - A recorded clip that never plays (a stubbed `Audio` whose position never
 *   moves and that fires no event) holds the pause only until the stall
 *   bound; then the button's text is spoken instead and scanning resumes.
 *
 * Run: `pnpm test:e2e:voices` (PLAYWRIGHT_BASE_URL = the standalone web server).
 */
import { expect, test, type Page } from '@playwright/test';
import { seedLocalState } from '../helpers/test-session';

test.use({ locale: 'en-US' });

/** Must match BOARD_CACHE_KEY / SELECTED_BOARD_KEY / STORAGE_KEY in apps/web/src/lib/communicator-settings.ts. */
const BOARD_CACHE_KEY = 'voxa-board-cache';
const SELECTED_BOARD_KEY = 'voxa-selected-board-id';
const SETTINGS_KEY = 'voxa-communicator-settings';
const BOARD_ID = 'e2e-scan-pause-board';
/** Scan step; the switch-interval minimum is 300 ms. */
const SCAN_INTERVAL_MS = 400;
/** Must match SPEECH_PAUSE_MIN_MS in apps/web/src/lib/play-button-speech.ts (bound for a one-word message). */
const SPEECH_PAUSE_MIN_MS = 2000;
/** Must match MEDIA_STALL_MS in apps/web/src/lib/play-button-speech.ts. */
const MEDIA_STALL_MS = 4000;
/** Same-origin media proxy path for the recorded clip; the test answers it itself. */
const CLIP_PATH = '/api/media/e2e-stuck-clip';

const button = (id: string, label: string, column: number) => ({
  kind: 'analytic',
  id,
  label,
  speechText: label,
  locale: 'es-MX',
  position: { row: 0, column },
  locked: false,
});

const BOARD = {
  id: BOARD_ID,
  name: 'Barrido E2E',
  profileId: 'default',
  version: 1,
  updatedAt: '2026-10-04T00:00:00.000Z',
  grid: {
    rows: 1,
    columns: 3,
    buttons: [button('yo', 'yo', 0), button('quiero', 'quiero', 1), button('agua', 'agua', 2)],
  },
};

/** The same board with a recorded clip on every button. */
const RECORDED_BOARD = {
  ...BOARD,
  grid: {
    ...BOARD.grid,
    buttons: BOARD.grid.buttons.map((b) => ({ ...b, audio: { url: CLIP_PATH, recordedBy: 'e2e-caregiver' } })),
  },
};

const SETTINGS = {
  accessMode: 'switch',
  switchScanMode: 'auto',
  switchIntervalMs: SCAN_INTERVAL_MS,
  switchGroupStrategy: 'none',
  pauseScanWhileSpeaking: true,
  auditoryScanHighlight: false,
  auditoryScanVoice: false,
  auditoryScanBeep: false,
};

async function stubStuckSpeech(page: Page, board: typeof BOARD = BOARD): Promise<void> {
  await seedLocalState(page);
  await page.addInitScript(
    ({ board, cacheKey, selectedKey, settingsKey, settings }) => {
      localStorage.setItem(cacheKey, JSON.stringify(board));
      localStorage.setItem(selectedKey, board.id);
      localStorage.setItem(settingsKey, JSON.stringify(settings));

      const spoken: Array<{ text: string; at: number }> = [];
      (window as unknown as { __voxaSpoken: typeof spoken }).__voxaSpoken = spoken;
      const target = new EventTarget();
      const synth = {
        // A stuck engine: once asked to speak it says it is speaking forever
        // and never fires end or error.
        speaking: false,
        pending: false,
        paused: false,
        getVoices: () => [],
        speak(u: { text: string }) {
          spoken.push({ text: u.text, at: performance.now() });
          synth.speaking = true;
        },
        cancel: () => undefined,
        pause: () => undefined,
        resume: () => undefined,
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
        dispatchEvent: target.dispatchEvent.bind(target),
      };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
      class StubUtterance {
        text: string;
        lang = '';
        voice: unknown = null;
        rate = 1;
        pitch = 1;
        volume = 1;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: StubUtterance });

      // Every change of the scanned button, with its time.
      const moves: Array<{ id: string; at: number }> = [];
      (window as unknown as { __voxaScanMoves: typeof moves }).__voxaScanMoves = moves;
      const record = () => {
        const el = document.querySelector('[data-voxa-scan="item"]');
        const id = el?.closest('[data-voxa-button-id]')?.getAttribute('data-voxa-button-id') ?? el?.getAttribute('data-voxa-button-id');
        if (id && moves[moves.length - 1]?.id !== id) moves.push({ id, at: performance.now() });
      };
      new MutationObserver(record).observe(document, { subtree: true, attributes: true, childList: true });
    },
    {
      board,
      cacheKey: `${BOARD_CACHE_KEY}:${BOARD_ID}`,
      selectedKey: SELECTED_BOARD_KEY,
      settingsKey: SETTINGS_KEY,
      settings: SETTINGS,
    },
  );
}

interface Move {
  id: string;
  at: number;
}

const moves = (page: Page) =>
  page.evaluate(() => (window as unknown as { __voxaScanMoves: Move[] }).__voxaScanMoves.slice());
const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __voxaSpoken: Array<{ text: string; at: number }> }).__voxaSpoken.slice());

test('switch scanning resumes after speech when the engine never fires end or error', async ({ page }) => {
  await stubStuckSpeech(page);
  await page.goto('/app');
  await expect(page.locator('[data-voxa-button-id="yo"]')).toBeVisible({ timeout: 30_000 });

  // The scan runs: the highlight moves at least twice.
  await expect.poll(async () => (await moves(page)).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);

  // Select with the switch: the highlighted button speaks and the scan pauses.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await spoken(page)).length, { timeout: 5_000 }).toBe(1);
  const [utterance] = await spoken(page);
  expect(['yo', 'quiero', 'agua']).toContain(utterance!.text);

  // Paused while the message could still be playing: no move for well over a scan step.
  await page.waitForTimeout(SPEECH_PAUSE_MIN_MS - 600);
  const duringPause = (await moves(page)).filter((m) => m.at > utterance!.at + SCAN_INTERVAL_MS);
  expect(duringPause, 'the scan held still while the engine reported speaking').toEqual([]);

  // ...and it resumes on its own after the bound, although the engine never said it finished.
  await expect
    .poll(async () => (await moves(page)).filter((m) => m.at > utterance!.at).length, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(2);
  const resumed = (await moves(page)).find((m) => m.at > utterance!.at + SCAN_INTERVAL_MS)!;
  expect(resumed.at - utterance!.at).toBeGreaterThanOrEqual(SPEECH_PAUSE_MIN_MS);
  expect(await page.evaluate(() => window.speechSynthesis.speaking), 'the stub engine is still stuck').toBe(true);
});

test.describe('recorded speech', () => {
  // The test answers the clip request itself; a service worker would take it first.
  test.use({ serviceWorkers: 'block' });

  test('switch scanning resumes when a recorded clip never plays, and the text is spoken instead', async ({ page }) => {
    await stubStuckSpeech(page, RECORDED_BOARD);
    await page.addInitScript(() => {
      // A stuck decoder: play() resolves, the position never moves, no event ever fires.
      const plays: number[] = [];
      (window as unknown as { __voxaAudioPlays: number[] }).__voxaAudioPlays = plays;
      class StuckAudio extends EventTarget {
        src: string;
        currentTime = 0;
        duration = Number.NaN;
        ended = false;
        paused = true;
        playbackRate = 1;
        constructor(src = '') {
          super();
          this.src = src;
        }
        play(): Promise<void> {
          plays.push(performance.now());
          this.paused = false;
          return Promise.resolve();
        }
        pause(): void {
          this.paused = true;
        }
      }
      Object.defineProperty(window, 'Audio', { configurable: true, value: StuckAudio });
    });
    await page.route(`**${CLIP_PATH}`, (route) =>
      route.fulfill({ status: 200, contentType: 'audio/webm', body: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]) }),
    );

    await page.goto('/app');
    await expect(page.locator('[data-voxa-button-id="yo"]')).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await moves(page)).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);

    await page.keyboard.press('Space');
    const plays = () => page.evaluate(() => (window as unknown as { __voxaAudioPlays: number[] }).__voxaAudioPlays.slice());
    await expect.poll(async () => (await plays()).length, { timeout: 5_000 }).toBe(1);
    const [playedAt] = await plays();

    // Held while the clip could still start: no move, and nothing spoken yet.
    await page.waitForTimeout(MEDIA_STALL_MS - 800);
    const duringClip = (await moves(page)).filter((m) => m.at > playedAt! + SCAN_INTERVAL_MS);
    expect(duringClip, 'the scan held still while the clip was expected to play').toEqual([]);
    expect(await spoken(page)).toEqual([]);

    // At the stall bound the clip is given up and the button's text is spoken instead...
    await expect.poll(async () => (await spoken(page)).length, { timeout: 5_000 }).toBe(1);
    const [fallback] = await spoken(page);
    expect(['yo', 'quiero', 'agua']).toContain(fallback!.text);
    expect(fallback!.at - playedAt!).toBeGreaterThanOrEqual(MEDIA_STALL_MS - 300);

    // ...and scanning resumes on its own (after that utterance's own bound), not never.
    await expect
      .poll(async () => (await moves(page)).filter((m) => m.at > fallback!.at).length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2);
  });
});
