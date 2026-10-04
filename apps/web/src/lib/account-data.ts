import { CONSENT_CACHE_KEY, LEGACY_CONSENT_KEY } from './consent';
import { BOARD_CACHE_KEY, PENDING_SAVE_KEY, SELECTED_BOARD_KEY } from './communicator-settings';
import { OFFLINE_DB_NAME } from './offline-idb';

/**
 * Account data kept in this browser, and how it is forgotten.
 *
 * Voxa runs on shared family and clinic tablets. On sign-out, on «Cambiar de
 * cuenta» and on «Entrar como otra persona», everything that belongs to the
 * account is deleted before the browser leaves the page:
 *
 * - the per-board offline copies (`voxa-board-cache:*`) and the selected board;
 * - queued offline saves (IndexedDB `voxa-offline` and the localStorage copy);
 * - the cached copy of the user's consent record;
 * - the editor unlock of this tab;
 * - the service worker's app-shell cache (`voxa-shell-*`).
 *
 * Device settings stay: the access method (switch scanning, dwell, touch
 * guard), display theme, the editor PIN and the install-banner choice belong
 * to the tablet and its communicator, not to the caregiver's account.
 *
 * Independently of those controls, `claimAccountData` records which account
 * the stored data belongs to; when the signed-in account differs (a session
 * that expired without sign-out, a switch on another tab), the data is purged
 * before the app uses it.
 */
export const ACCOUNT_OWNER_KEY = 'voxa-account-owner';
export const SHELL_CACHE_PREFIX = 'voxa-shell-';
const EDITOR_UNLOCK_KEY = 'voxa-editor-unlocked';

const ACCOUNT_KEY_PREFIXES = [`${BOARD_CACHE_KEY}:`, `${PENDING_SAVE_KEY}:`];
const ACCOUNT_KEYS = [SELECTED_BOARD_KEY, CONSENT_CACHE_KEY, LEGACY_CONSENT_KEY, ACCOUNT_OWNER_KEY];

/** Removes the account's keys from a Storage (synchronous part of the purge). */
export function purgeAccountStorage(storage: Storage): void {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (ACCOUNT_KEYS.includes(key) || ACCOUNT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      doomed.push(key);
    }
  }
  for (const key of doomed) storage.removeItem(key);
}

function deleteOfflineDatabase(): Promise<void> {
  if (typeof indexedDB === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(OFFLINE_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteShellCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(SHELL_CACHE_PREFIX)).map((n) => caches.delete(n)));
  } catch {
    /* CacheStorage unavailable (private mode) */
  }
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'voxa:forget-account' });
  } catch {
    /* no worker */
  }
}

/** Deletes everything listed above. Never throws. */
export async function purgeAccountData(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') purgeAccountStorage(localStorage);
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(EDITOR_UNLOCK_KEY);
  } catch {
    /* storage unavailable */
  }
  await Promise.all([deleteOfflineDatabase(), deleteShellCaches()]);
}

/**
 * Marks this browser's account data as belonging to `userId`. When it belonged
 * to another account, or to no recorded account, it is purged first. Returns
 * true when a purge ran.
 */
export async function claimAccountData(userId: string): Promise<boolean> {
  let owner: string | null = null;
  try {
    owner = localStorage.getItem(ACCOUNT_OWNER_KEY);
  } catch {
    return false;
  }
  if (owner === userId) return false;
  await purgeAccountData();
  try {
    localStorage.setItem(ACCOUNT_OWNER_KEY, userId);
  } catch {
    /* storage unavailable */
  }
  return true;
}
