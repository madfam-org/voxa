import type { BrowserContext, Page } from '@playwright/test';

/**
 * Credential-free authenticated session for CI a11y scans.
 *
 * WHY THIS IS SAFE — read before changing anything here.
 * ------------------------------------------------------
 * This mints a `voxa_session` cookie locally. It does NOT weaken production
 * auth, and it required no change to any auth code, because of how Voxa's
 * session already works:
 *
 *   1. `verifyIdToken()` (jose + remote JWKS) runs exactly once, in
 *      /auth/callback, BEFORE the cookie is written. That is the real
 *      security boundary and it is untouched.
 *   2. `getSession()` in apps/web/src/lib/auth.ts reads the cookie with
 *      `JSON.parse` and checks only `expires_at`. The session cookie is
 *      plain JSON by design — it is never signature-checked on read.
 *   3. `middleware.ts` gates routes on `cookies.get('voxa_session')` —
 *      presence only, no verification.
 *   4. All of the above is inert in CI regardless: the a11y job starts the
 *      standalone server with no OIDC env, so `isOidcConfigured()` is false
 *      and middleware does not gate `/app` at all.
 *
 * So a locally-minted cookie is accepted by the same code path a real one
 * takes, and forging one buys an attacker nothing they could not already do
 * by calling the unauthenticated app directly. The cookie's `access_token` is
 * a structurally-valid but unsigned JWT: /api/auth/session derives teamRole
 * with `decodeJwt` (decode, not verify), which is what lets this fixture
 * select the `editor` role and reach the SLP-only surfaces. Voxa reads only
 * namespaced Janua application roles (`voxa:editor`, `voxa:admin`), so that
 * is what the fixture projects.
 *
 * The cookie is scoped to the local test origin and is never sent anywhere
 * else. Against a REAL deployment this fixture would simply fail — a genuine
 * API would reject the unsigned token — which is the correct outcome.
 */

export interface TestSessionOptions {
  /** Team role to project into the access-token claims. */
  role?: 'communicator' | 'editor' | 'admin';
  userId?: string;
  email?: string;
  name?: string;
}

function base64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

/**
 * Build an unsigned but structurally-valid JWT. Only the payload matters:
 * /api/auth/session uses `decodeJwt`, never `jwtVerify`, for role mapping.
 */
function unsignedJwt(claims: Record<string, unknown>): string {
  const header = base64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify(claims));
  return `${header}.${payload}.`;
}

/**
 * Hostnames the cookie must cover. Next.js normalizes the standalone server's
 * host during the locale redirect, so a run started against 127.0.0.1 ends up
 * on localhost (and vice versa). Cookies are host-scoped, so seeding both
 * keeps the in-page /api/auth/session XHR authenticated after the redirect —
 * without this, the page silently falls back to unauthenticated and the
 * editor-only surfaces never render.
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

/** Seed a Voxa session cookie so authenticated surfaces render. */
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
  } = options;

  const session = {
    access_token: unsignedJwt({
      sub: userId,
      email,
      name,
      // Communicator is the absence of a Voxa app role.
      roles: role === 'communicator' ? [] : [`voxa:${role}`],
    }),
    user_id: userId,
    email,
    name,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  };

  const secure = baseURL.startsWith('https://');
  await context.addCookies(
    cookieHosts(baseURL).map((domain) => ({
      name: 'voxa_session',
      value: JSON.stringify(session),
      domain,
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax' as const,
    })),
  );
}

/** Seed the local state the app expects so no consent gate covers the scan. */
export async function seedLocalState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('voxa-ai-consent', 'granted');
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
  // The editor-only chrome renders after /api/auth/session resolves.
  await page.getByRole('button', { name: 'Audit' }).waitFor({ timeout: 20_000 });
}
