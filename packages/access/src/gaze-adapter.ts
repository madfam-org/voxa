export interface GazePoint {
  x: number;
  y: number;
}

/**
 * Gaze event bridge: DOM event name an integrator dispatches with viewport
 * coordinates (`{ x, y }`) so Voxa applies dwell at that point. A stable API;
 * Voxa ships no eye-tracker driver or helper.
 */
export const VOXA_GAZE_EVENT = 'voxa:gaze';

/** Resolve a board button id from viewport coordinates via data-voxa-button-id markers. */
export function resolveGazeButtonId(x: number, y: number, doc?: Document): string | null {
  const root = doc ?? (typeof document !== 'undefined' ? document : null);
  if (!root) return null;
  const target = root.elementFromPoint(x, y);
  if (!target) return null;
  const button = target.closest('[data-voxa-button-id]');
  return button?.getAttribute('data-voxa-button-id') ?? null;
}

export function dispatchGazePoint(point: GazePoint, target?: Window): void {
  if (typeof window === 'undefined') return;
  (target ?? window).dispatchEvent(new CustomEvent<GazePoint>(VOXA_GAZE_EVENT, { detail: point }));
}
