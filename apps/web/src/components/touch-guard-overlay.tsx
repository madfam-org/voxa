'use client';

import {
  isTouchGuardBlocker,
  touchGuardGridSize,
  type TouchGuardMask,
} from '@voxa/access';

export interface TouchGuardOverlayProps {
  rows: number;
  columns: number;
  mask: TouchGuardMask;
  gapMm?: number;
  /** Match BoardGrid padding (px). */
  paddingPx?: number;
}

const BLOCKER_STYLE: React.CSSProperties = {
  pointerEvents: 'auto',
  background: 'rgba(15, 23, 42, 0.38)',
  touchAction: 'none',
};

export function TouchGuardOverlay({
  rows,
  columns,
  mask,
  gapMm = 4,
  paddingPx = 16,
}: TouchGuardOverlayProps): React.ReactNode {
  const gap = `${gapMm}mm`;
  const { overlayRows, overlayColumns } = touchGuardGridSize(rows, columns);
  const rowTemplate = Array.from({ length: overlayRows }, (_, index) =>
    index % 2 === 0 ? '1fr' : gap,
  ).join(' ');
  const columnTemplate = Array.from({ length: overlayColumns }, (_, index) =>
    index % 2 === 0 ? '1fr' : gap,
  ).join(' ');

  return (
    <div
      aria-hidden
      data-testid="touch-guard-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        padding: paddingPx,
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateRows: rowTemplate,
          gridTemplateColumns: columnTemplate,
          width: '100%',
          height: '100%',
          minHeight: 0,
        }}
      >
        {Array.from({ length: overlayRows * overlayColumns }, (_, index) => {
          const overlayRow = Math.floor(index / overlayColumns);
          const overlayColumn = index % overlayColumns;
          const block = isTouchGuardBlocker(overlayRow, overlayColumn, rows, columns, mask);
          return (
            <div
              key={`${overlayRow}-${overlayColumn}`}
              style={block ? BLOCKER_STYLE : { pointerEvents: 'none' }}
              onPointerDown={
                block
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

export interface TouchGuardListOverlayProps {
  stepCount: number;
  mask: TouchGuardMask;
  gapPx?: number;
  paddingPx?: number;
}

/** Horizontal blockers between vertical schedule steps. */
export function TouchGuardListOverlay({
  stepCount,
  mask,
  gapPx = 10,
  paddingPx = 16,
}: TouchGuardListOverlayProps): React.ReactNode {
  if (stepCount <= 1 || mask === 'perimeter') {
    return null;
  }

  const slots = stepCount * 2 - 1;

  return (
    <div
      aria-hidden
      data-testid="touch-guard-list-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        padding: paddingPx,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: gapPx,
      }}
    >
      {Array.from({ length: slots }, (_, index) => (
        <div
          key={index}
          style={
            index % 2 === 1
              ? { ...BLOCKER_STYLE, flexShrink: 0, height: gapPx }
              : { pointerEvents: 'none', flex: 1, minHeight: 0 }
          }
          onPointerDown={
            index % 2 === 1
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}
