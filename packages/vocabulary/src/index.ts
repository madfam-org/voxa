import type { BoardButton, GridPosition } from '@voxa/core';

/** Modified Fitzgerald Key — part-of-speech color coding */
export const FITZGERALD_KEY = {
  adjective: { label: 'Adjective', hex: '#2563eb' },
  verb: { label: 'Verb', hex: '#16a34a' },
  pronoun: { label: 'Pronoun', hex: '#eab308' },
  noun: { label: 'Noun', hex: '#ea580c' },
  preposition: { label: 'Preposition / Social', hex: '#db2777' },
  conjunction: { label: 'Conjunction', hex: '#ffffff' },
} as const;

export type PartOfSpeech = keyof typeof FITZGERALD_KEY;

export function fitzgeraldColor(pos: PartOfSpeech): string {
  return FITZGERALD_KEY[pos].hex;
}

/** Returns buttons whose locked positions would change between versions */
export function findMotorPlanningViolations(
  previous: BoardButton[],
  next: BoardButton[],
): Array<{ buttonId: string; previous: GridPosition; next: GridPosition }> {
  const prevById = new Map(previous.map((b) => [b.id, b]));
  const violations: Array<{ buttonId: string; previous: GridPosition; next: GridPosition }> = [];

  for (const button of next) {
    const prev = prevById.get(button.id);
    if (!prev?.locked) continue;

    const moved =
      prev.position.row !== button.position.row ||
      prev.position.column !== button.position.column;

    if (moved) {
      violations.push({
        buttonId: button.id as string,
        previous: prev.position,
        next: button.position,
      });
    }
  }

  return violations;
}

export function isGlpPhrase(text: string): boolean {
  return text.trim().split(/\s+/).length > 1;
}

export {
  GRID_MAX_CELLS,
  GRID_MAX_DIMENSION,
  GRID_MIN_CELLS,
  GRID_MIN_DIMENSION,
  resizeBoardGrid,
  validateGridDimensions,
  type GridResizeResult,
} from './grid.js';

export {
  mergeSpeechForms,
  suggestInflections,
  type InflectionKind,
} from './inflections.js';

export {
  createButtonAtCell,
  GridMoveError,
  moveButtonToCell,
  type MoveButtonOptions,
  type MoveButtonResult,
} from './grid-moves.js';

export {
  guessPartOfSpeechFromLabel,
  partOfSpeechFromBorderColor,
  resolvePartOfSpeech,
} from './part-of-speech.js';
