const SYNC_TAG = 'voxa-board-save';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('sync', (event) => {
  const syncEvent = event as Event & { tag: string; waitUntil: (p: Promise<unknown>) => void };
  if (syncEvent.tag !== SYNC_TAG) return;

  syncEvent.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: 'voxa:flush-pending-save' });
      }
    }),
  );
});
