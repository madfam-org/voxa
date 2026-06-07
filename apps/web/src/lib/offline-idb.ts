const DB_NAME = 'voxa-offline';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function idbGet(key: string): Promise<string | undefined> {
  const db = await openDb();
  const value = await new Promise<string | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as string | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

export async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export const SYNC_TAG = 'voxa-board-save';

export async function registerBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  if ('sync' in reg) {
    await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(
      SYNC_TAG,
    );
  }
}
