import { createButtonId, type BoardButton } from '@voxa/core';

export interface MoveButtonResult {
  buttons: BoardButton[];
  swappedWith?: string;
}

export interface MoveButtonOptions {
  /** Admin override — allow moving locked buttons or swapping into locked slots */
  forceLocked?: boolean;
}

export class GridMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GridMoveError';
  }
}

function buttonAt(buttons: BoardButton[], row: number, column: number): BoardButton | undefined {
  return buttons.find((btn) => btn.position.row === row && btn.position.column === column);
}

export function moveButtonToCell(
  buttons: BoardButton[],
  buttonId: string,
  toRow: number,
  toColumn: number,
  options?: MoveButtonOptions,
): MoveButtonResult {
  const moving = buttons.find((btn) => (btn.id as string) === buttonId);
  if (!moving) throw new GridMoveError('Button not found');

  if (moving.locked && !options?.forceLocked) {
    throw new GridMoveError('Unlock the motor-plan slot before moving this button.');
  }

  const target = buttonAt(buttons, toRow, toColumn);
  if (!target) {
    return {
      buttons: buttons.map((btn) =>
        (btn.id as string) === buttonId ? { ...btn, position: { row: toRow, column: toColumn } } : btn,
      ),
    };
  }

  if ((target.id as string) === buttonId) {
    return { buttons };
  }

  if (target.locked && !options?.forceLocked) {
    throw new GridMoveError('That slot is locked — choose an empty or unlocked cell.');
  }

  const from = { ...moving.position };
  return {
    buttons: buttons.map((btn) => {
      if ((btn.id as string) === buttonId) {
        return { ...btn, position: { row: toRow, column: toColumn } };
      }
      if ((btn.id as string) === (target.id as string)) {
        return { ...btn, position: from };
      }
      return btn;
    }),
    swappedWith: target.id as string,
  };
}

export function createButtonAtCell(
  buttons: BoardButton[],
  row: number,
  column: number,
  label: string,
): BoardButton[] {
  if (buttonAt(buttons, row, column)) {
    throw new GridMoveError('That cell already has a button.');
  }

  const trimmed = label.trim();
  if (!trimmed) throw new GridMoveError('Label is required');

  const next: BoardButton = {
    kind: 'analytic',
    id: createButtonId(`btn-${Date.now()}-${row}-${column}`),
    label: trimmed,
    speechText: trimmed,
    locale: 'en-US',
    position: { row, column },
    locked: false,
    partOfSpeech: 'noun',
  };

  return [...buttons, next];
}
