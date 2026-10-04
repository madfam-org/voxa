import type {
  AccessProfile,
  ScanOrder,
  SwitchGroupStrategy,
  SwitchScanMode,
  TouchActivationMode,
  TouchGuardMask,
} from '@voxa/access';
import { clampGroupCycles, DEFAULT_GROUP_CYCLES } from '@voxa/access';
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
  /** 'auto': one switch, the scan moves on a timer. 'step': switch 1 moves, switch 2 selects. */
  switchScanMode: SwitchScanMode;
  /** Group scan: full cycles inside a group without a selection before returning to group level. */
  switchGroupCycles: number;
  /** Extra time the first item of each level stays highlighted (ms). */
  switchFirstItemHoldMs: number;
  /** Presses shorter than this are ignored (ms; 0 = on press). */
  switchAcceptanceMs: number;
  /** Pause after a selection before scanning resumes (ms). */
  switchPostSelectionPauseMs: number;
  eyeDwellMs: number;
  /**
   * 'pointer': dwell on whatever drives the pointer (mouse, head pointer, or an
   * eye tracker that moves the pointer). 'event-bridge': dwell on coordinates an
   * integrator sends through the `voxa:gaze` DOM event.
   */
  gazeSource: 'pointer' | 'event-bridge';
  auditoryScanHighlight: boolean;
  auditoryScanVoice: boolean;
  auditoryScanBeep: boolean;
  pauseScanWhileSpeaking: boolean;
  touchActivation: TouchActivationMode;
  touchGuardEnabled: boolean;
  touchGuardMask: TouchGuardMask;
  /**
   * @deprecated No effect: Mulberry Symbols have no skin-tone variants and the
   * picker was removed. Kept so stored settings keep parsing; remove together
   * with its last reader in board-screen.tsx.
   */
  defaultSymbolSkinTone: ArasaacSkinTone;
  whisperMode: boolean;
  hideSymbols: boolean;
  hideLabels: boolean;
  /**
   * Spanish boards: conjugate the verb after a subject pronoun when the
   * message is built ("yo querer" → "yo quiero"). The message bar always
   * offers the base form; this turns the suggestion off entirely.
   */
  spanishAgreement: boolean;
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
  switchScanMode: 'auto',
  switchGroupCycles: 2,
  switchFirstItemHoldMs: 0,
  switchAcceptanceMs: 0,
  switchPostSelectionPauseMs: 0,
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
  spanishAgreement: true,
};

const STORAGE_KEY = 'voxa-communicator-settings';

/** Scan timing bounds for the settings UI and for stored values. */
export const SCAN_FIRST_ITEM_HOLD_MAX_MS = 3000;
export const SCAN_ACCEPTANCE_MAX_MS = 1000;
export const SCAN_POST_SELECTION_PAUSE_MAX_MS = 3000;

function clampMs(value: unknown, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback;
}

/** Merge stored settings over the defaults, migrating renamed values. */
export function normalizeCommunicatorSettings(stored: unknown): CommunicatorSettings {
  if (!stored || typeof stored !== 'object') return DEFAULT_COMMUNICATOR_SETTINGS;
  const raw = stored as Partial<CommunicatorSettings>;
  const merged: CommunicatorSettings = { ...DEFAULT_COMMUNICATOR_SETTINGS, ...raw };
  // The gaze event bridge was stored as 'tobii-bridge' before 2026-10.
  const storedGaze: unknown = raw.gazeSource;
  merged.gazeSource = storedGaze === 'event-bridge' || storedGaze === 'tobii-bridge' ? 'event-bridge' : 'pointer';
  merged.switchScanMode = raw.switchScanMode === 'step' ? 'step' : 'auto';
  merged.switchGroupCycles = clampGroupCycles(Number(raw.switchGroupCycles ?? DEFAULT_GROUP_CYCLES));
  merged.switchFirstItemHoldMs = clampMs(raw.switchFirstItemHoldMs, SCAN_FIRST_ITEM_HOLD_MAX_MS, 0);
  merged.switchAcceptanceMs = clampMs(raw.switchAcceptanceMs, SCAN_ACCEPTANCE_MAX_MS, 0);
  merged.switchPostSelectionPauseMs = clampMs(raw.switchPostSelectionPauseMs, SCAN_POST_SELECTION_PAUSE_MAX_MS, 0);
  return merged;
}

export function loadCommunicatorSettings(): CommunicatorSettings {
  if (typeof window === 'undefined') return DEFAULT_COMMUNICATOR_SETTINGS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COMMUNICATOR_SETTINGS;
    return normalizeCommunicatorSettings(JSON.parse(raw));
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
