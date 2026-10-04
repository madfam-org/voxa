'use client';

import { useEffect } from 'react';
import { offlineCacheUrls } from '@/lib/offline-cache-urls';

const OFFLINE_READY_MESSAGE = 'voxa:cache-urls-done';

/**
 * Registers `/sw.js` and, once it is active, hands it the URLs this page has
 * already loaded. On the first visit the worker did not control the page yet,
 * so without this the next offline start would miss the shell's chunks.
 * When the worker has stored them it answers, and the page marks
 * `<html data-voxa-offline="ready">`.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === OFFLINE_READY_MESSAGE) {
        document.documentElement.dataset.voxaOffline = 'ready';
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        if (cancelled || !registration.active) return;
        const loaded = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name);
        registration.active.postMessage({
          type: 'voxa:cache-urls',
          urls: offlineCacheUrls(window.location.href, loaded),
        });
      })
      .catch(() => {
        /* no service worker (private mode, unsupported browser): the app still works online */
      });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  return null;
}
