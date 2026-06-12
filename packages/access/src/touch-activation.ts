export type TouchActivationMode = 'press' | 'release';

export const DEFAULT_TOUCH_ACTIVATION: TouchActivationMode = 'press';

export function activatesOnPress(mode: TouchActivationMode): boolean {
  return mode === 'press';
}

export function activatesOnRelease(mode: TouchActivationMode): boolean {
  return mode === 'release';
}
