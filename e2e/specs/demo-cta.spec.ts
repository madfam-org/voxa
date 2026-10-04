/**
 * The public demo never blocks communication (C-026): against the built web
 * app with a stubbed `speechSynthesis`.
 *
 * - 20 taps on board buttons give 20 `speechSynthesis.speak` calls, and no
 *   dialog opens at any point.
 * - After real use the call to action shows as a region below the board: it
 *   never overlaps the board or the message bar, does not move or resize
 *   them, and does not take focus.
 * - It is keyboard operable (its controls are reachable with Tab; Escape
 *   dismisses it) and the page has no WCAG 2.2 AA violations (axe) with it
 *   visible.
 * - Paid-plan intent («Plans for schools and clinics») points to the
 *   discovery call.
 *
 * Run with the a11y job: `pnpm test:e2e:a11y` (PLAYWRIGHT_BASE_URL = the
 * standalone web server).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { analyzeCurrentPage, formatViolations } from '../helpers/a11y';
import { ui } from '../helpers/i18n';
import { seedLocalState } from '../helpers/test-session';

test.use({ locale: 'en-US' });

const TAPS = 20;
/** Must match DISCOVERY_CALL_URL in apps/web/src/lib/pricing.ts. */
const DISCOVERY_CALL_URL = 'https://kalya.app/madfam';

/**
 * Privacy choices are recorded first (the one-time consent banner is a
 * separate, required notice, not a sales gate), then speech is stubbed.
 */
async function stubSpeech(page: Page): Promise<void> {
  await seedLocalState(page);
  await page.addInitScript(() => {
    const spoken: string[] = [];
    const dialogs: string[] = [];
    const w = window as unknown as { __voxaSpoken: string[]; __voxaDialogs: string[] };
    w.__voxaSpoken = spoken;
    w.__voxaDialogs = dialogs;
    const target = new EventTarget();
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => [],
      speak: (u: { text: string; onend?: (() => void) | null }) => {
        spoken.push(u.text);
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
    // Record any dialog that ever appears, even one that closes again.
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog[open]')) {
        const label = el.getAttribute('aria-labelledby') ?? el.getAttribute('aria-label') ?? el.tagName;
        if (!dialogs.includes(label)) dialogs.push(label);
      }
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
}

const spokenCount = (page: Page) =>
  page.evaluate(() => (window as unknown as { __voxaSpoken: string[] }).__voxaSpoken.length);
const dialogsSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __voxaDialogs: string[] }).__voxaDialogs);

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

/** Page coordinates, so scrolling between measurements does not matter. */
async function pageBox(page: Page, locator: Locator): Promise<Box> {
  const b = await box(locator);
  const scrollY = await page.evaluate(() => window.scrollY);
  return { ...b, y: b.y + scrollY };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function openDemo(page: Page) {
  await stubSpeech(page);
  await page.goto('/demo');
  const grid = page.getByRole('grid', { name: ui('board.gridLabel') });
  await expect(grid).toBeVisible({ timeout: 30_000 });
  const buttons = grid.getByRole('button');
  await expect(buttons.first()).toBeVisible();
  const speak = page.getByRole('button', { name: ui('common.speak'), exact: true });
  await expect(speak).toBeVisible();
  const messageBar = page.locator('[data-voxa-message-bar]');
  await expect(messageBar).toBeVisible();
  return { grid, buttons, speak, messageBar };
}

test.describe('public demo: communication is never blocked (C-026)', () => {
  test(`${TAPS} taps speak ${TAPS} times and never open a dialog; the call to action stays out of the way`, async ({
    page,
  }) => {
    const { grid, buttons, messageBar } = await openDemo(page);
    const cta = page.locator('[data-voxa-demo-cta]');
    const gridBefore = await pageBox(page, grid);
    const barBefore = await pageBox(page, messageBar);
    const count = await buttons.count();
    expect(count).toBeGreaterThan(3);

    for (let i = 0; i < TAPS; i += 1) {
      // Taps go to the board itself: nothing may intercept them.
      await buttons.nth(i % count).click({ timeout: 5_000 });
      await expect.poll(() => spokenCount(page)).toBe(i + 1);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }

    expect(await spokenCount(page)).toBe(TAPS);
    expect(await dialogsSeen(page)).toEqual([]);

    // After real use the call to action is there, as a region, not a dialog.
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('data-voxa-demo-cta', 'parent');
    await expect(page.getByRole('region', { name: ui('demo.gates.firstMessage.title') })).toBeVisible();

    // It took no focus and did not cover, move or resize the board or the message bar.
    const focusedInCta = await cta.evaluate((el) => el.contains(document.activeElement));
    expect(focusedInCta).toBe(false);
    const ctaBox = await pageBox(page, cta);
    const gridAfter = await pageBox(page, grid);
    const barAfter = await pageBox(page, messageBar);
    expect(overlaps(ctaBox, gridAfter)).toBe(false);
    expect(overlaps(ctaBox, barAfter)).toBe(false);
    expect(gridAfter).toEqual(gridBefore);
    expect(barAfter).toEqual(barBefore);
    // Nothing is stacked over the board: the element at a button's centre is that button.
    const first = await box(buttons.first());
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label') ?? null,
      { x: first.x + first.width / 2, y: first.y + first.height / 2 },
    );
    expect(hit).toBe(await buttons.first().getAttribute('aria-label'));

    // axe (WCAG 2.2 AA) with the call to action visible.
    const results = await analyzeCurrentPage(page);
    expect(results.violations, JSON.stringify(formatViolations(results.violations), null, 2)).toEqual([]);
  });

  test('the call to action is keyboard operable and Escape dismisses it', async ({ page }) => {
    const { buttons } = await openDemo(page);
    for (let i = 0; i < 5; i += 1) await buttons.nth(i).click();
    const cta = page.locator('[data-voxa-demo-cta]');
    await expect(cta).toBeVisible();

    const dismiss = cta.getByRole('button', { name: ui('gate.keepExploring') });
    await dismiss.focus();
    await page.keyboard.press('Shift+Tab');
    expect(await cta.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(cta).toHaveCount(0);

    // Shown once on its own: more speech does not bring it back.
    for (let i = 0; i < 6; i += 1) await buttons.nth(i).click();
    await expect.poll(() => spokenCount(page)).toBe(11);
    await expect(cta).toHaveCount(0);
  });

  test('asking for school and clinic plans shows the call to action, focused, pointing to the discovery call', async ({
    page,
  }) => {
    await openDemo(page);
    await page.getByRole('button', { name: ui('demo.institutionalPlans') }).click();
    const cta = page.locator('[data-voxa-demo-cta="institution"]');
    await expect(cta).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: ui('demo.gates.institution.title') })).toBeFocused();
    await expect(cta.getByRole('link', { name: ui('gate.requestDemo') })).toHaveAttribute('href', DISCOVERY_CALL_URL);
    await cta.getByRole('button', { name: ui('gate.keepExploring') }).press('Enter');
    await expect(cta).toHaveCount(0);
  });
});
