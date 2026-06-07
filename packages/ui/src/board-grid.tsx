import type { CSSProperties, ReactNode } from 'react';
import { CVI_THEMES, type CviTheme } from './index.js';

export interface BoardGridProps {
  rows: number;
  columns: number;
  theme?: CviTheme;
  targetScale?: number;
  gapMm?: number;
  children?: ReactNode;
}

export function BoardGrid({
  rows,
  columns,
  theme = 'cvi-dark',
  targetScale = 1,
  gapMm = 4,
  children,
}: BoardGridProps) {
  const t = CVI_THEMES[theme];
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: `${gapMm}mm`,
    width: '100%',
    height: '100%',
    minHeight: 0,
    padding: 16,
    backgroundColor: t.background,
    color: t.foreground,
    boxSizing: 'border-box',
    ['--voxa-target-scale' as string]: targetScale,
  };

  return (
    <div role="grid" aria-label="Communication board" style={gridStyle}>
      {children}
    </div>
  );
}
