import type { GridCell, ScanOrder } from './index.js';

export type SwitchGroupStrategy = 'none' | 'rows' | 'regions';

function linearScanIndex(order: ScanOrder, rows: number, columns: number, step: number): number {
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

export function indexToCell(index: number, columns: number): GridCell {
  return { row: Math.floor(index / columns), column: index % columns };
}

export function cellKey(cell: GridCell): string {
  return `${cell.row},${cell.column}`;
}

/** One scan group per grid row (top to bottom). */
export function buildRowScanGroups(rows: number, columns: number): GridCell[][] {
  const groups: GridCell[][] = [];
  for (let row = 0; row < rows; row++) {
    const cells: GridCell[] = [];
    for (let column = 0; column < columns; column++) {
      cells.push({ row, column });
    }
    groups.push(cells);
  }
  return groups;
}

/** Up to four quadrant regions (2×2 split of the grid). */
export function buildRegionScanGroups(rows: number, columns: number): GridCell[][] {
  const midRow = Math.ceil(rows / 2);
  const midCol = Math.ceil(columns / 2);
  const regions: GridCell[][] = [[], [], [], []];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const regionRow = row < midRow ? 0 : 1;
      const regionCol = column < midCol ? 0 : 1;
      regions[regionRow * 2 + regionCol]!.push({ row, column });
    }
  }

  return regions.filter((cells) => cells.length > 0);
}

export function buildCustomScanGroups(
  groups: number[][],
  rows: number,
  columns: number,
): GridCell[][] {
  const capacity = rows * columns;
  return groups
    .map((indices) =>
      indices
        .filter((index) => index >= 0 && index < capacity)
        .map((index) => indexToCell(index, columns)),
    )
    .filter((cells) => cells.length > 0);
}

export function resolveScanGroups(
  rows: number,
  columns: number,
  strategy: SwitchGroupStrategy,
  customGroups?: number[][],
): GridCell[][] | null {
  if (strategy === 'none') return null;
  if (strategy === 'rows') return buildRowScanGroups(rows, columns);
  if (strategy === 'regions') return buildRegionScanGroups(rows, columns);
  if (customGroups?.length) return buildCustomScanGroups(customGroups, rows, columns);
  return null;
}

/** Scan order within a group, respecting row/column-major settings. */
export function buildGroupCellPath(
  cells: GridCell[],
  rows: number,
  columns: number,
  order: ScanOrder,
): GridCell[] {
  const allowed = new Set(cells.map(cellKey));
  const path: GridCell[] = [];
  const total = rows * columns;

  for (let step = 0; step < total; step++) {
    const index = linearScanIndex(order, rows, columns, step);
    const cell = { row: Math.floor(index / columns), column: index % columns };
    if (allowed.has(cellKey(cell))) path.push(cell);
  }

  return path;
}

export function groupScanLabel(groupIndex: number, strategy: SwitchGroupStrategy, cells: GridCell[]): string {
  if (strategy === 'rows') {
    return `Row ${(cells[0]?.row ?? groupIndex) + 1}`;
  }
  if (strategy === 'regions') {
    const labels = ['Top left', 'Top right', 'Bottom left', 'Bottom right'];
    return labels[groupIndex] ?? `Region ${groupIndex + 1}`;
  }
  return `Group ${groupIndex + 1}`;
}
