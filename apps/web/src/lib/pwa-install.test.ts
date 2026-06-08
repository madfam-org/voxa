import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dismissPwaInstallPrompt,
  isPwaInstallDismissed,
  PWA_INSTALL_DISMISS_KEY,
} from './pwa-install.js';

describe('pwa install prompt', () => {
  it('tracks dismiss state in localStorage', () => {
    const storage = new Map<string, string>();
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });

    try {
      assert.equal(isPwaInstallDismissed(), false);
      dismissPwaInstallPrompt();
      assert.equal(storage.get(PWA_INSTALL_DISMISS_KEY), '1');
      assert.equal(isPwaInstallDismissed(), true);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: original,
      });
    }
  });
});
