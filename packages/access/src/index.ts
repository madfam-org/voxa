export type ScanOrder = 'row-major' | 'column-major' | 'linear';

export interface SwitchScanConfig {
  order: ScanOrder;
  intervalMs: number;
  rows: number;
  columns: number;
  groups?: number[][];
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

  if (order === 'column-major') {
    const col = Math.floor(wrapped / rows);
    const row = wrapped % rows;
    return row * columns + col;
  }

  return wrapped;
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
