import type { AccessProfile, ScanOrder, SwitchGroupStrategy, TouchActivationMode, TouchGuardMask } from '@voxa/access';
import type { ArasaacSkinTone, BoardDisplayPreferences } from '@voxa/core';
import type { ContentLocale, UiLocale } from '@voxa/i18n';
import { CONTENT_LOCALE_BY_UI, DEFAULT_UI_LOCALE } from '@voxa/i18n';
import type { CviTheme } from '@voxa/ui';

export interface CommunicatorSettings {
  uiLocale: UiLocale;
  contentLocale: ContentLocale;
  accessMode: AccessProfile['mode'];
  cviTheme: CviTheme;
  targetScale: number;
  switchIntervalMs: number;
  switchOrder: ScanOrder;
  switchGroupStrategy: SwitchGroupStrategy;
  eyeDwellMs: number;
  gazeSource: 'pointer' | 'tobii-bridge';
  auditoryScanHighlight: boolean;
  auditoryScanVoice: boolean;
  auditoryScanBeep: boolean;
  pauseScanWhileSpeaking: boolean;
  touchActivation: TouchActivationMode;
  touchGuardEnabled: boolean;
  touchGuardMask: TouchGuardMask;
  defaultSymbolSkinTone: ArasaacSkinTone;
  whisperMode: boolean;
  hideSymbols: boolean;
  hideLabels: boolean;
}

export const DEFAULT_COMMUNICATOR_SETTINGS: CommunicatorSettings = {
  uiLocale: DEFAULT_UI_LOCALE,
  contentLocale: CONTENT_LOCALE_BY_UI[DEFAULT_UI_LOCALE],
  accessMode: 'touch',
  cviTheme: 'cvi-dark',
  targetScale: 1.2,
  switchIntervalMs: 1200,
  switchOrder: 'row-major',
  switchGroupStrategy: 'none',
  eyeDwellMs: 1000,
  gazeSource: 'pointer',
  auditoryScanHighlight: true,
  auditoryScanVoice: false,
  auditoryScanBeep: true,
  pauseScanWhileSpeaking: true,
  touchActivation: 'press',
  touchGuardEnabled: false,
  touchGuardMask: 'both',
  defaultSymbolSkinTone: 'white',
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
