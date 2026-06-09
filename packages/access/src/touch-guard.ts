export type TouchGuardMask = 'gutter' | 'perimeter' | 'both';

export interface TouchGuardSettings {
  enabled: boolean;
  mask: TouchGuardMask;
}

export const DEFAULT_TOUCH_GUARD: TouchGuardSettings = {
  enabled: false,
  mask: 'both',
};

export function touchGuardActive(settings: TouchGuardSettings): boolean {
  return settings.enabled;
}

export function touchGuardGridSize(
  rows: number,
  columns: number,
): { overlayRows: number; overlayColumns: number } {
  const safeRows = Math.max(1, rows);
  const safeColumns = Math.max(1, columns);
  return {
    overlayRows: Math.max(1, 2 * safeRows - 1),
    overlayColumns: Math.max(1, 2 * safeColumns - 1),
  };
}

/** Overlay cells aligned with board buttons sit on even indices. */
export function isTouchGuardHole(overlayRow: number, overlayColumn: number): boolean {
  return overlayRow % 2 === 0 && overlayColumn % 2 === 0;
}

function isTouchGuardPerimeter(
  overlayRow: number,
  overlayColumn: number,
  overlayRows: number,
  overlayColumns: number,
): boolean {
  return (
    overlayRow === 0 ||
    overlayColumn === 0 ||
    overlayRow === overlayRows - 1 ||
    overlayColumn === overlayColumns - 1
  );
}

/** Whether an interleaved overlay cell should capture touches. */
export function isTouchGuardBlocker(
  overlayRow: number,
  overlayColumn: number,
  rows: number,
  columns: number,
  mask: TouchGuardMask,
): boolean {
  if (isTouchGuardHole(overlayRow, overlayColumn)) {
    return false;
  }

  const { overlayRows, overlayColumns } = touchGuardGridSize(rows, columns);
  const onEdge = isTouchGuardPerimeter(overlayRow, overlayColumn, overlayRows, overlayColumns);

  switch (mask) {
    case 'gutter':
      return !onEdge;
    case 'perimeter':
      return onEdge;
    case 'both':
      return true;
    default:
      return false;
  }
}
