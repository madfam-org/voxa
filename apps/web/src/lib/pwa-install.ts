export const PWA_INSTALL_DISMISS_KEY = 'voxa-pwa-install-dismissed';

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export function isPwaInstallDismissed(): boolean {
  if (!hasLocalStorage()) return false;
  return localStorage.getItem(PWA_INSTALL_DISMISS_KEY) === '1';
}

export function dismissPwaInstallPrompt(): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(PWA_INSTALL_DISMISS_KEY, '1');
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type { BeforeInstallPromptEvent };
