import {
  DEFAULT_CORE_GRID_TEMPLATE,
  DEMO_BOARD_ID,
  isCoreGridTemplateId,
  isStarterContentLocale,
  type CoreGridTemplateId,
  type StarterContentLocale,
} from '@voxa/core';
import type { CommunicatorSettings } from './communicator-settings';

/**
 * First-run setup: shown once to a signed-in user with no board, reachable
 * again from Settings. Choices are saved in the communicator settings (the
 * same local store the Settings panel writes); the first board is created on
 * the server from the chosen core template.
 */

export type FirstRunStep = 'language' | 'access' | 'size' | 'voice' | 'create';
export const FIRST_RUN_STEPS: readonly FirstRunStep[] = ['language', 'access', 'size', 'voice', 'create'];

/** Access methods offered by the setup; each maps onto the existing access settings. */
export type FirstRunAccess = 'touch' | 'switch' | 'dwell' | 'keyguard';
export const FIRST_RUN_ACCESS: readonly FirstRunAccess[] = ['touch', 'switch', 'dwell', 'keyguard'];

export const FIRST_RUN_LANGUAGES: readonly StarterContentLocale[] = ['es-MX', 'en-US', 'fr-FR'];

export interface FirstRunBoardSummary {
  id: string;
  name: string;
  ownerUserId?: string;
}

const DONE_KEY_PREFIX = 'voxa-first-run-done';

function doneKey(userId: string): string {
  return `${DONE_KEY_PREFIX}:${userId}`;
}

/** True once this user finished or skipped the setup on this device (storage errors read as not done). */
export function isFirstRunDone(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(doneKey(userId)) !== null;
  } catch {
    return false;
  }
}

export function markFirstRunDone(userId: string, outcome: 'completed' | 'skipped'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(doneKey(userId), outcome);
  } catch {
    /* storage unavailable: the setup may show again, which is harmless */
  }
}

/** A board the user can already use (owned first, else any shared one); never the read-only demo. */
export function existingBoardFor(
  catalog: readonly FirstRunBoardSummary[],
  userId: string,
): FirstRunBoardSummary | undefined {
  const usable = catalog.filter((board) => board.id !== DEMO_BOARD_ID);
  return usable.find((board) => board.ownerUserId === userId) ?? usable[0];
}

export interface FirstRunGate {
  /** Communicator screen (`/app`), not the remote editor or the public demo. */
  communicatorScreen: boolean;
  signedIn: boolean;
  /** The board list was loaded from the API (never decide on a failed or pending load). */
  catalogLoaded: boolean;
  catalog: readonly FirstRunBoardSummary[];
  userId: string;
  done: boolean;
}

/** Show the setup automatically: signed in, list loaded, no usable board, not shown before. */
export function shouldOfferFirstRun(gate: FirstRunGate): boolean {
  return (
    gate.communicatorScreen &&
    gate.signedIn &&
    gate.catalogLoaded &&
    !gate.done &&
    existingBoardFor(gate.catalog, gate.userId) === undefined
  );
}

/** Settings patch for an access choice (reuses the Settings panel's fields). */
export function accessSettingsPatch(choice: FirstRunAccess): Partial<CommunicatorSettings> {
  switch (choice) {
    case 'switch':
      return { accessMode: 'switch' };
    case 'dwell':
      return { accessMode: 'eye-tracking', gazeSource: 'pointer' };
    case 'keyguard':
      return { accessMode: 'touch', touchGuardEnabled: true };
    case 'touch':
    default:
      return { accessMode: 'touch', touchGuardEnabled: false };
  }
}

/** The access choice the current settings correspond to (the setup's initial selection). */
export function accessChoiceFromSettings(settings: Pick<CommunicatorSettings, 'accessMode' | 'touchGuardEnabled'>): FirstRunAccess {
  if (settings.accessMode === 'switch') return 'switch';
  if (settings.accessMode === 'eye-tracking') return 'dwell';
  return settings.touchGuardEnabled ? 'keyguard' : 'touch';
}

/** The board language the setup starts on: the stored content locale, else es-MX. */
export function initialBoardLanguage(contentLocale: unknown): StarterContentLocale {
  return isStarterContentLocale(contentLocale) ? contentLocale : 'es-MX';
}

export function initialGridTemplate(value?: unknown): CoreGridTemplateId {
  return isCoreGridTemplateId(value) ? value : DEFAULT_CORE_GRID_TEMPLATE;
}
