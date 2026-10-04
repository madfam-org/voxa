import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ACCOUNT_OWNER_KEY, claimAccountData, purgeAccountData, purgeAccountStorage } from './account-data';

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const ACCOUNT_KEYS = [
  'voxa-board-cache:family-board',
  'voxa-board-cache:demo-core',
  'voxa-pending-board-save:family-board',
  'voxa-selected-board-id',
  'voxa-consent',
  'voxa-ai-consent',
];
const DEVICE_KEYS = ['voxa-communicator-settings', 'voxa-editor-pin', 'voxa-pwa-install-dismissed', 'unrelated'];

const g = globalThis as unknown as {
  localStorage?: Storage;
  sessionStorage?: Storage;
  indexedDB?: unknown;
  caches?: unknown;
};
let local: MemoryStorage;
let session: MemoryStorage;
let deletedDatabases: string[];
let cacheNames: string[];

beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  for (const key of [...ACCOUNT_KEYS, ...DEVICE_KEYS]) local.setItem(key, 'x');
  session.setItem('voxa-editor-unlocked', '1');
  deletedDatabases = [];
  cacheNames = ['voxa-shell-v2', 'voxa-static-v2', 'voxa-symbols-v2'];
  g.localStorage = local;
  g.sessionStorage = session;
  g.indexedDB = {
    deleteDatabase(name: string) {
      deletedDatabases.push(name);
      const request: { onsuccess?: () => void } = {};
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  g.caches = {
    keys: async () => [...cacheNames],
    delete: async (name: string) => {
      cacheNames = cacheNames.filter((n) => n !== name);
      return true;
    },
  };
});

afterEach(() => {
  delete g.localStorage;
  delete g.sessionStorage;
  delete g.indexedDB;
  delete g.caches;
});

describe('account data purge (sign-out and switching on a shared tablet)', () => {
  it('purgeAccountStorage removes board copies, queued saves, selection and consent cache only', () => {
    purgeAccountStorage(local);
    for (const key of ACCOUNT_KEYS) assert.equal(local.getItem(key), null, key);
    for (const key of DEVICE_KEYS) assert.equal(local.getItem(key), 'x', key);
  });

  it('purgeAccountData also deletes the offline database, the editor unlock and the shell cache', async () => {
    await purgeAccountData();
    assert.deepEqual(deletedDatabases, ['voxa-offline']);
    assert.equal(session.getItem('voxa-editor-unlocked'), null);
    assert.deepEqual(cacheNames, ['voxa-static-v2', 'voxa-symbols-v2']);
    for (const key of ACCOUNT_KEYS) assert.equal(local.getItem(key), null, key);
  });

  it('claimAccountData purges data left by another account before the new one uses it', async () => {
    local.setItem(ACCOUNT_OWNER_KEY, 'user-a');
    assert.equal(await claimAccountData('user-b'), true);
    for (const key of ACCOUNT_KEYS) assert.equal(local.getItem(key), null, key);
    assert.equal(local.getItem(ACCOUNT_OWNER_KEY), 'user-b');
  });

  it('claimAccountData keeps the data of the same account', async () => {
    local.setItem(ACCOUNT_OWNER_KEY, 'user-a');
    assert.equal(await claimAccountData('user-a'), false);
    for (const key of ACCOUNT_KEYS) assert.equal(local.getItem(key), 'x', key);
  });

  it('data with no recorded owner is treated as someone else’s', async () => {
    assert.equal(await claimAccountData('user-a'), true);
    assert.equal(local.getItem('voxa-board-cache:family-board'), null);
  });
});
