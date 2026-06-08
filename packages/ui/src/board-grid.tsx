import { Children, type CSSProperties, type ReactNode } from 'react';
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
  const gap = `${gapMm}mm`;
  const gridStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap,
    width: '100%',
    height: '100%',
    minHeight: 0,
    padding: 16,
    backgroundColor: t.background,
    color: t.foreground,
    boxSizing: 'border-box',
    ['--voxa-target-scale' as string]: targetScale,
  };

  const rowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap,
    flex: 1,
    minHeight: 0,
  };

  const cellStyle: CSSProperties = {
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
  };

  const cells = Children.toArray(children);
  const rowCount = Math.max(rows, Math.ceil(cells.length / Math.max(columns, 1)));
  const matrix: ReactNode[][] = [];
  for (let r = 0; r < rowCount; r += 1) {
    matrix.push(cells.slice(r * columns, (r + 1) * columns));
  }

  return (
    <div role="grid" aria-label="Communication board" aria-rowcount={rowCount} aria-colcount={columns} style={gridStyle}>
      {matrix.map((rowCells, rowIndex) => (
        <div role="row" aria-rowindex={rowIndex + 1} key={`row-${rowIndex}`} style={rowStyle}>
          {rowCells.map((cell, colIndex) => (
            <div
              role="gridcell"
              aria-colindex={colIndex + 1}
              key={`cell-${rowIndex}-${colIndex}`}
              style={cellStyle}
            >
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
