/**
 * Offline start and uploaded media, against the built standalone web server
 * and a real local API (`helpers/local-api.ts`, real RS256 tokens).
 *
 * - `/app` reopens without a connection: the service worker serves the
 *   cached shell and the board renders.
 * - An uploaded photo on an owned board renders (same-origin media proxy).
 * - A GLP button shows its video in a visible element.
 * - When recorded media cannot be fetched, the button's speech text is spoken.
 *
 * Run: build web (with NEXT_PUBLIC_API_URL = VOXA_E2E_API_URL) and the API,
 * start the web server, then `pnpm test:e2e:offline` with PLAYWRIGHT_BASE_URL.
 * One worker only (the script passes --workers=1): the API port is fixed by
 * the web build.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { WCAG_TAGS, formatViolations } from '../helpers/a11y';
import { ui } from '../helpers/i18n';
import { startLocalApi, type LocalApi } from '../helpers/local-api';
import { seedLocalState, seedTestSession } from '../helpers/test-session';

const API_URL = process.env.VOXA_E2E_API_URL ?? 'http://localhost:4000';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const OWNER_ID = 'e2e-media-owner';
const BOARD_ID = 'e2e-media-board';
const PHOTO_ID = 'e2e-photo';
const GLP_ID = 'e2e-glp';
const RECORDED_ID = 'e2e-recorded';
const RECORDED_SPEECH = 'hola desde la grabación';
/** Must match SELECTED_BOARD_KEY in apps/web/src/lib/communicator-settings.ts. */
const SELECTED_BOARD_KEY = 'voxa-selected-board-id';

const fixture = (name: string) => readFileSync(path.join(__dirname, '..', 'fixtures', name));

// The standalone server in CI listens on 127.0.0.1; pin the UI language so
// every run takes the same `/app` -> `/en/app` locale route.
test.use({ locale: 'en-US' });

let api: LocalApi;
let ownerToken: string;
/**
 * One API and one seeded board per worker: with `--repeat-each` Playwright
 * may run the next repetition's beforeAll before this one's afterAll, and
 * the API port is fixed by the web build.
 */
let shared: { ready: Promise<void>; users: number } | null = null;

async function apiCall(method: string, route: string, body?: unknown): Promise<Response> {
  return fetch(`${api.url}${route}`, {
    method,
    headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function uploadMedia(bytes: Buffer, filename: string, type: string): Promise<string> {
  const form = new FormData();
  form.set('boardId', BOARD_ID);
  form.set('file', new File([new Uint8Array(bytes)], filename, { type }));
  const res = await fetch(`${api.url}/v1/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: form,
  });
  if (res.status !== 201) throw new Error(`upload ${filename}: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { url: string }).url;
}

/** A short WebM clip recorded from a canvas (Chromium encodes VP8 without codecs from the OS). */
async function recordWebm(page: Page): Promise<Buffer> {
  await page.setContent('<canvas width="320" height="240"></canvas>');
  const base64 = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.start(250);
    for (let frame = 0; frame < 80; frame += 1) {
      ctx.fillStyle = `hsl(${frame * 9}, 70%, 50%)`;
      ctx.fillRect(0, 0, 320, 240);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: 'video/webm' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  });
  return Buffer.from(base64, 'base64');
}

async function openOwnedBoard(page: Page, context: BrowserContext): Promise<void> {
  await seedTestSession(context, BASE_URL, {
    userId: OWNER_ID,
    role: 'communicator',
    accessToken: ownerToken,
  });
  await seedLocalState(page);
  await page.addInitScript(
    ({ key, boardId }) => {
      localStorage.setItem(key, boardId);
      const spoken: string[] = [];
      (window as unknown as { __voxaSpoken: string[] }).__voxaSpoken = spoken;
      if ('speechSynthesis' in window) {
        const synth = window.speechSynthesis;
        const original = synth.speak.bind(synth);
        synth.speak = (utterance: SpeechSynthesisUtterance) => {
          spoken.push(utterance.text);
          try {
            original(utterance);
          } catch {
            /* headless without voices */
          }
        };
      }
    },
    { key: SELECTED_BOARD_KEY, boardId: BOARD_ID },
  );
  await page.goto('/app');
  await expect(page.locator(`[data-voxa-button-id="${PHOTO_ID}"]`)).toBeVisible({
    timeout: 30_000,
  });
}

test.beforeAll(async ({ browser }) => {
  if (!shared) shared = { ready: seed(browser), users: 0 };
  shared.users += 1;
  await shared.ready;
});

test.afterAll(async () => {
  if (!shared) return;
  shared.users -= 1;
  if (shared.users > 0) return;
  shared = null;
  await api?.stop();
});

async function seed(browser: Browser): Promise<void> {
  api = await startLocalApi(API_URL);
  ownerToken = api.token({ sub: OWNER_ID, email: 'owner@voxa.test', name: 'E2E Owner' });

  const consent = await apiCall('PUT', '/v1/consents', {
    consents: { ai_processing: false, usage_analytics: false },
  });
  expect(consent.status).toBe(200);

  const created = await apiCall('POST', '/v1/boards', {
    id: BOARD_ID,
    name: 'E2E media board',
    profileId: 'default',
    version: 1,
    updatedAt: new Date().toISOString(),
    grid: { rows: 2, columns: 2, buttons: [] },
  });
  expect(created.status).toBe(201);
  const { board } = (await created.json()) as {
    board: Record<string, unknown> & { version: number };
  };

  const page = await browser.newPage();
  const webm = await recordWebm(page);
  await page.close();

  const photoUrl = await uploadMedia(fixture('test-symbol.png'), 'photo.png', 'image/png');
  const audioUrl = await uploadMedia(fixture('test-recording.wav'), 'voice.wav', 'audio/wav');
  const videoUrl = await uploadMedia(webm, 'phrase.webm', 'video/webm');

  const saved = await apiCall('PUT', `/v1/boards/${BOARD_ID}`, {
    ...board,
    grid: {
      rows: 2,
      columns: 2,
      buttons: [
        {
          kind: 'analytic',
          id: PHOTO_ID,
          label: 'foto',
          speechText: 'foto',
          symbolUrl: photoUrl,
          locale: 'es-MX',
          position: { row: 0, column: 0 },
          locked: false,
        },
        {
          kind: 'glp',
          id: GLP_ID,
          phrase: 'vamos al parque',
          video: { url: videoUrl, mimeType: 'video/webm' },
          locale: 'es-MX',
          position: { row: 0, column: 1 },
          locked: false,
        },
        {
          kind: 'analytic',
          id: RECORDED_ID,
          label: 'hola',
          speechText: RECORDED_SPEECH,
          audio: { url: audioUrl, recordedBy: OWNER_ID },
          locale: 'es-MX',
          position: { row: 1, column: 0 },
          locked: false,
        },
      ],
    },
    expectedVersion: board.version,
  });
  expect(saved.status).toBe(200);
}

test.describe('offline start', () => {
  test('reloading /app offline renders the board from the service worker cache', async ({
    page,
    context,
  }) => {
    await seedTestSession(context, BASE_URL, {
      userId: OWNER_ID,
      role: 'communicator',
      accessToken: ownerToken,
    });
    await seedLocalState(page);
    await page.goto('/app');
    const buttons = page.locator('[data-voxa-button-id]');
    await expect.poll(() => buttons.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(47);

    // The worker confirms it stored the shell and what the page loaded...
    await page.waitForSelector('html[data-voxa-offline="ready"]', {
      state: 'attached',
      timeout: 30_000,
    });
    // ...and it controls the page and holds the shell and every loaded chunk.
    const cached = await page.evaluate(async () => {
      if (!navigator.serviceWorker.controller) return 'no controller';
      if (!(await caches.match(location.origin + location.pathname))) return 'no shell';
      const chunks = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => new URL(name).pathname.startsWith('/_next/static/'));
      for (const chunk of chunks) {
        if (!(await caches.match(chunk))) return `missing ${chunk}`;
      }
      return chunks.length > 0 ? 'ok' : 'no chunks';
    });
    expect(cached).toBe('ok');

    await context.setOffline(true);
    await page.reload();
    await expect.poll(() => buttons.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(47);
    // The page really has no network: a same-origin request that the worker
    // leaves to the network fails.
    const health = await page.evaluate(() =>
      fetch('/api/health', { cache: 'no-store' }).then(
        (res) => `status ${res.status}`,
        () => 'offline',
      ),
    );
    expect(health).toBe('offline');
    await context.setOffline(false);
  });
});

test.describe('uploaded media', () => {
  // Media requests are routed in these tests; the worker would hide them from page.route.
  test.use({ serviceWorkers: 'block' });

  test('an uploaded photo on an owned board renders', async ({ page, context }) => {
    await openOwnedBoard(page, context);
    const img = page.locator(`[data-voxa-button-id="${PHOTO_ID}"] img`);
    await expect(img).toHaveAttribute('src', /^\/api\/media\/[A-Za-z0-9_-]+$/);
    await expect
      .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  test('a GLP button shows its video in a visible element', async ({ page, context }) => {
    await openOwnedBoard(page, context);
    await page.locator(`[data-voxa-button-id="${GLP_ID}"]`).click();
    const video = page.locator('[data-voxa-glp-video] video');
    await expect(video).toBeVisible({ timeout: 15_000 });
    const box = await video.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(100);
    expect(box!.height).toBeGreaterThanOrEqual(100);
    await expect(page.getByRole('dialog', { name: 'vamos al parque' })).toBeVisible();
    await expect(page.getByRole('button', { name: ui('common.close') })).toBeFocused();
    const scan = await new AxeBuilder({ page })
      .include('[data-voxa-glp-video]')
      .withTags([...WCAG_TAGS])
      .analyze();
    expect(formatViolations(scan.violations)).toEqual([]);
    // Keyboard and key-emulating switches dismiss it.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-voxa-glp-video]')).toHaveCount(0);
  });

  test('recorded speech falls back to text-to-speech when media answers 503', async ({
    page,
    context,
  }) => {
    await page.route('**/api/media/**', (route) =>
      route.fulfill({ status: 503, body: 'unavailable' }),
    );
    await openOwnedBoard(page, context);
    await page.locator(`[data-voxa-button-id="${RECORDED_ID}"]`).click();
    await expect
      .poll(
        () => page.evaluate(() => (window as unknown as { __voxaSpoken: string[] }).__voxaSpoken),
        {
          timeout: 10_000,
        },
      )
      .toContain(RECORDED_SPEECH);
  });
});
