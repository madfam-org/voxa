import type { AccessProfile, ScanOrder } from '@voxa/access';
import type { BoardDisplayPreferences } from '@voxa/core';
import type { CviTheme } from '@voxa/ui';

export interface CommunicatorSettings {
  accessMode: AccessProfile['mode'];
  cviTheme: CviTheme;
  targetScale: number;
  switchIntervalMs: number;
  switchOrder: ScanOrder;
  eyeDwellMs: number;
  auditoryScanHighlight: boolean;
  whisperMode: boolean;
  hideSymbols: boolean;
  hideLabels: boolean;
}

export const DEFAULT_COMMUNICATOR_SETTINGS: CommunicatorSettings = {
  accessMode: 'touch',
  cviTheme: 'cvi-dark',
  targetScale: 1.2,
  switchIntervalMs: 1200,
  switchOrder: 'row-major',
  eyeDwellMs: 1000,
  auditoryScanHighlight: true,
  whisperMode: false,
  hideSymbols: false,
  hideLabels: false,
};

const STORAGE_KEY = 'voxa-communicator-settings';

export function loadCommunicatorSettings(): CommunicatorSettings {
  if (typeof window === 'undefined') return DEFAULT_COMMUNICATOR_SETTINGS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COMMUNICATOR_SETTINGS;
    return { ...DEFAULT_COMMUNICATOR_SETTINGS, ...(JSON.parse(raw) as Partial<CommunicatorSettings>) };
  } catch {
    return DEFAULT_COMMUNICATOR_SETTINGS;
  }
}

export function saveCommunicatorSettings(settings: CommunicatorSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Merge profile defaults with optional per-board display overrides (B5). */
export function effectiveDisplaySettings(
  profile: CommunicatorSettings,
  boardDisplay?: BoardDisplayPreferences,
): Pick<CommunicatorSettings, 'hideSymbols' | 'hideLabels'> {
  return {
    hideSymbols: boardDisplay?.hideSymbols ?? profile.hideSymbols,
    hideLabels: boardDisplay?.hideLabels ?? profile.hideLabels,
  };
}

export const BOARD_CACHE_KEY = 'voxa-board-cache';
export const PENDING_SAVE_KEY = 'voxa-pending-board-save';
export const SELECTED_BOARD_KEY = 'voxa-selected-board-id';
