export type ScanOrder = 'row-major' | 'column-major' | 'linear';

export const SWITCH_INTERVAL_MIN_MS = 300;
export const SWITCH_INTERVAL_MAX_MS = 5000;
export const EYE_DWELL_MIN_MS = 500;
export const EYE_DWELL_MAX_MS = 3000;

export interface SwitchScanConfig {
  order: ScanOrder;
  intervalMs: number;
  rows: number;
  columns: number;
  groups?: number[][];
  auditoryHighlight?: boolean;
}

export interface EyeTrackingConfig {
  dwellMs: number;
  snapRadiusPx: number;
  cancelOnSaccade: boolean;
}

export interface AccessProfile {
  mode: 'touch' | 'switch' | 'eye-tracking';
  switch?: SwitchScanConfig;
  eyeTracking?: EyeTrackingConfig;
}

const DEFAULT_SWITCH: SwitchScanConfig = {
  order: 'row-major',
  intervalMs: 1200,
  rows: 4,
  columns: 6,
};

const DEFAULT_EYE: EyeTrackingConfig = {
  dwellMs: 1000,
  snapRadiusPx: 48,
  cancelOnSaccade: true,
};

export function linearScanIndex(order: ScanOrder, rows: number, columns: number, step: number): number {
  const total = rows * columns;
  const wrapped = ((step % total) + total) % total;
  const resolved = order === 'linear' ? 'row-major' : order;

  if (resolved === 'column-major') {
    const col = Math.floor(wrapped / rows);
    const row = wrapped % rows;
    return row * columns + col;
  }

  return wrapped;
}

export interface GridCell {
  row: number;
  column: number;
}

/** Full grid scan path respecting row/column-major order */
export function buildGridScanPath(rows: number, columns: number, order: ScanOrder): GridCell[] {
  const total = rows * columns;
  const path: GridCell[] = [];

  for (let step = 0; step < total; step++) {
    const index = linearScanIndex(order, rows, columns, step);
    path.push({ row: Math.floor(index / columns), column: index % columns });
  }

  return path;
}

export function clampSwitchInterval(ms: number): number {
  return Math.min(SWITCH_INTERVAL_MAX_MS, Math.max(SWITCH_INTERVAL_MIN_MS, ms));
}

export function clampEyeDwell(ms: number): number {
  return Math.min(EYE_DWELL_MAX_MS, Math.max(EYE_DWELL_MIN_MS, ms));
}

export function createAccessProfile(mode: AccessProfile['mode']): AccessProfile {
  if (mode === 'switch') return { mode, switch: { ...DEFAULT_SWITCH } };
  if (mode === 'eye-tracking') return { mode, eyeTracking: { ...DEFAULT_EYE } };
  return { mode: 'touch' };
}

/** Expand hit box for magnetic snap-to-item eye tracking */
export function snapHitBox(
  x: number,
  y: number,
  targetX: number,
  targetY: number,
  radiusPx: number,
): boolean {
  const dx = x - targetX;
  const dy = y - targetY;
  return dx * dx + dy * dy <= radiusPx * radiusPx;
}

export {
  dispatchGazePoint,
  resolveGazeButtonId,
  VOXA_GAZE_EVENT,
  type GazePoint,
} from './gaze-adapter.js';
export {
  classifySwitchKey,
  classifySwitchNativeKey,
  SWITCH_ADVANCE_KEY_CODES,
  SWITCH_ADVANCE_NATIVE_KEYS,
  SWITCH_SELECT_KEY_CODES,
  SWITCH_SELECT_NATIVE_KEYS,
  type SwitchKeyAction,
} from './switch-input.js';
