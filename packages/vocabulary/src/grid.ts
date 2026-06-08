import type { BoardButton } from '@voxa/core';

export const GRID_MIN_CELLS = 9;
export const GRID_MAX_CELLS = 144;
export const GRID_MIN_DIMENSION = 2;
export const GRID_MAX_DIMENSION = 12;

export interface GridResizeResult {
  rows: number;
  columns: number;
  buttons: BoardButton[];
  warnings: string[];
}

function cellKey(row: number, column: number): string {
  return `${row},${column}`;
}

function buttonLabel(btn: BoardButton): string {
  return btn.kind === 'analytic' ? btn.label : btn.phrase;
}

export function validateGridDimensions(rows: number, columns: number): string | null {
  if (!Number.isInteger(rows) || !Number.isInteger(columns)) {
    return 'Rows and columns must be whole numbers';
  }
  if (rows < GRID_MIN_DIMENSION || columns < GRID_MIN_DIMENSION) {
    return `Minimum ${GRID_MIN_DIMENSION} rows and ${GRID_MIN_DIMENSION} columns`;
  }
  if (rows > GRID_MAX_DIMENSION || columns > GRID_MAX_DIMENSION) {
    return `Maximum ${GRID_MAX_DIMENSION} rows and ${GRID_MAX_DIMENSION} columns`;
  }
  const cells = rows * columns;
  if (cells < GRID_MIN_CELLS) {
    return `Grid must have at least ${GRID_MIN_CELLS} cells (${rows}×${columns} = ${cells})`;
  }
  if (cells > GRID_MAX_CELLS) {
    return `Grid cannot exceed ${GRID_MAX_CELLS} cells (${rows}×${columns} = ${cells})`;
  }
  return null;
}

export function resizeBoardGrid(
  buttons: BoardButton[],
  nextRows: number,
  nextColumns: number,
): GridResizeResult {
  const validationError = validateGridDimensions(nextRows, nextColumns);
  if (validationError) throw new Error(validationError);

  const capacity = nextRows * nextColumns;
  if (buttons.length > capacity) {
    throw new Error(
      `Grid has ${capacity} cells but ${buttons.length} buttons. Remove buttons or increase grid size.`,
    );
  }

  const inBounds = (btn: BoardButton) =>
    btn.position.row < nextRows && btn.position.column < nextColumns;

  for (const btn of buttons) {
    if (btn.locked && !inBounds(btn)) {
      throw new Error(
        `Motor-plan locked "${buttonLabel(btn)}" is outside the new grid. Increase grid size or unlock the slot.`,
      );
    }
  }

  const warnings: string[] = [];
  const occupied = new Set<string>();
  const nextButtons: BoardButton[] = [];
  const placedIds = new Set<string>();

  for (const btn of buttons) {
    if (btn.locked && inBounds(btn)) {
      nextButtons.push({ ...btn, position: { ...btn.position } });
      occupied.add(cellKey(btn.position.row, btn.position.column));
      placedIds.add(btn.id as string);
    }
  }

  for (const btn of buttons) {
    if (placedIds.has(btn.id as string)) continue;
    if (inBounds(btn) && !occupied.has(cellKey(btn.position.row, btn.position.column))) {
      nextButtons.push({ ...btn, position: { ...btn.position } });
      occupied.add(cellKey(btn.position.row, btn.position.column));
      placedIds.add(btn.id as string);
    }
  }

  const pending = buttons.filter((btn) => !placedIds.has(btn.id as string));
  for (const btn of pending) {
    let placed = false;
    for (let row = 0; row < nextRows; row += 1) {
      for (let column = 0; column < nextColumns; column += 1) {
        if (occupied.has(cellKey(row, column))) continue;
        nextButtons.push({ ...btn, position: { row, column } });
        occupied.add(cellKey(row, column));
        if (btn.position.row !== row || btn.position.column !== column) {
          warnings.push(`Reflowed "${buttonLabel(btn)}" to row ${row + 1}, column ${column + 1}.`);
        }
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed) throw new Error('Not enough grid cells to place all buttons.');
  }

  return { rows: nextRows, columns: nextColumns, buttons: nextButtons, warnings };
}
