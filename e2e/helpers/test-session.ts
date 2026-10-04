import type { BrowserContext, Page } from '@playwright/test';
import { mintSessionCookieValue } from '../../apps/web/src/lib/session-mint';

/**
 * Credential-free signed-in session for CI scans and specs.
 *
 * The web app's session is an Auth.js cookie encrypted with AUTH_SECRET. The
 * CI a11y job starts the standalone server with a TEST-ONLY AUTH_SECRET (and
 * placeholder Janua settings), and this helper encrypts a session with that
 * same secret, exactly as Auth.js does (`apps/web/src/lib/session-mint.ts`).
 * Nothing in the app was weakened for it: a cookie minted with any other
 * secret is rejected, and against a real deployment (whose secret this repo
 * never sees) the helper simply produces a cookie the server cannot decrypt.
 *
 * The role travels in the session, as it does after a real sign-in, where it
 * comes from the RS256-verified Janua access token. Specs that call a real
 * local API pass `accessToken` (an RS256 token from `local-api.ts`); the proxy
 * forwards it as the bearer. Otherwise a placeholder that no API accepts.
 */
export const E2E_AUTH_SECRET =
  process.env.VOXA_E2E_AUTH_SECRET ?? 'voxa-e2e-test-only-auth-secret-not-for-deploy';

/** Auth.js cookie name for an http origin (`__Secure-` only on https). */
export function sessionCookieNameFor(baseURL: string): string {
  return baseURL.startsWith('https://') ? '__Secure-authjs.session-token' : 'authjs.session-token';
}

export interface TestSessionOptions {
  /** Voxa role carried by the session. */
  role?: 'communicator' | 'editor' | 'admin';
  userId?: string;
  email?: string;
  name?: string;
  /** A real signed access token for specs that run against a local API (see local-api.ts). */
  accessToken?: string;
  /** Session id token, for sign-out's `id_token_hint`. */
  idToken?: string;
}

/**
 * Hostnames the cookie must cover. A standalone server bound to one address
 * (HOSTNAME=127.0.0.1) hands middleware a `localhost` request URL, so its
 * locale redirect moves a run started against 127.0.0.1 to localhost (and vice
 * versa); CI binds 0.0.0.0 like production, which keeps the host, but a local
 * run may not. Cookies are host-scoped, so seeding both keeps the in-page
 * /api/auth/session XHR authenticated after such a redirect — without this,
 * the page silently falls back to unauthenticated and the editor-only
 * surfaces never render.
 */
function cookieHosts(baseURL: string): string[] {
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(baseURL).hostname);
  } catch {
    /* fall through to the defaults below */
  }
  hosts.add('127.0.0.1');
  hosts.add('localhost');
  return [...hosts];
}

/** Seed a signed-in session cookie (encrypted with the test-only AUTH_SECRET). */
export async function seedTestSession(
  context: BrowserContext,
  baseURL: string,
  options: TestSessionOptions = {},
): Promise<void> {
  const {
    role = 'editor',
    userId = 'a11y-test-user',
    email = 'a11y@voxa.test',
    name = 'A11y Test User',
    accessToken = 'e2e-placeholder-access-token',
    idToken,
  } = options;

  const cookieName = sessionCookieNameFor(baseURL);
  const value = await mintSessionCookieValue({
    secret: E2E_AUTH_SECRET,
    cookieName,
    token: {
      userId,
      name,
      email,
      teamRole: role,
      accessToken,
      idToken,
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
    },
  });
  if (value.length > 3900) throw new Error('Test session cookie would need chunking; keep fixtures small');

  const secure = baseURL.startsWith('https://');
  await context.addCookies(
    cookieHosts(baseURL).map((domain) => ({
      name: cookieName,
      value,
      domain,
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax' as const,
    })),
  );
  // The browser's stored data already belongs to this account (otherwise the
  // app purges it on first load, as it does for a real account change).
  await context.addInitScript((owner) => {
    localStorage.setItem('voxa-account-owner', owner);
  }, userId);
}

/**
 * Seed the local state the app expects so no consent banner covers the scan.
 * The API is not running in the a11y job, so the banner falls back to this
 * offline cache (key and shape: CONSENT_CACHE_KEY in apps/web/src/lib/consent.ts).
 */
export async function seedLocalState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'voxa-consent',
      JSON.stringify({
        choices: { aiProcessing: true, usageAnalytics: true },
        utteranceText: false,
        source: 'local',
        decidedAt: '2026-10-03T00:00:00.000Z',
      }),
    );
    localStorage.removeItem('voxa-editor-pin');
    sessionStorage.removeItem('voxa-editor-unlocked');
  });
}

/** Must match BOARD_CACHE_KEY / SELECTED_BOARD_KEY in apps/web/src/lib/communicator-settings.ts. */
const BOARD_CACHE_KEY = 'voxa-board-cache';
const SELECTED_BOARD_KEY = 'voxa-selected-board-id';
const DEMO_BOARD_ID = 'demo-core';
export const TEST_OWNED_BOARD_ID = 'a11y-owned-board';

/**
 * Open the remote-SLP editor at /app/edit with an editor-role session on a
 * board the mocked user owns.
 *
 * /app/edit is used rather than /app because it derives its role from the
 * session (an account editor skips the device editor PIN), so no
 * window.prompt can block a headless scan.
 *
 * The shared demo board is read-only (no editor mode on it), and the a11y job
 * runs no API. So the first load lets the app fall back to its built-in demo
 * board, which it caches in localStorage; that cached content is copied into a
 * board owned by the mocked user, selected, and the page reloaded. The editor
 * then renders the same buttons as before, on an owned board, through the same
 * offline-cache path the app uses when the API is unreachable.
 */
export async function openAuthenticatedEditor(
  page: Page,
  context: BrowserContext,
  baseURL: string,
): Promise<void> {
  const userId = 'a11y-test-user';
  await seedTestSession(context, baseURL, { role: 'editor', userId });
  await seedLocalState(page);
  await page.goto('/app/edit');
  await page.waitForLoadState('networkidle');

  const demoCacheKey = `${BOARD_CACHE_KEY}:${DEMO_BOARD_ID}`;
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, demoCacheKey, {
    timeout: 20_000,
  });
  await page.evaluate(
    ({ demoCacheKey, cachePrefix, selectedKey, boardId, ownerUserId }) => {
      const demo = JSON.parse(localStorage.getItem(demoCacheKey) as string) as Record<string, unknown>;
      const owned = { ...demo, id: boardId, name: 'A11y owned board', ownerUserId };
      localStorage.setItem(`${cachePrefix}:${boardId}`, JSON.stringify(owned));
      localStorage.setItem(selectedKey, boardId);
    },
    {
      demoCacheKey,
      cachePrefix: BOARD_CACHE_KEY,
      selectedKey: SELECTED_BOARD_KEY,
      boardId: TEST_OWNED_BOARD_ID,
      ownerUserId: userId,
    },
  );

  await page.reload();
  await page.waitForLoadState('networkidle');
  // The editor-only chrome renders after /api/auth/session resolves (identity and role only).
  await page.getByRole('button', { name: 'Audit' }).waitFor({ timeout: 20_000 });
}
