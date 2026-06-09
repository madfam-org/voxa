import type { Board, BoardButton } from './index.js';

export type KeyboardRole = 'char' | 'space' | 'backspace' | 'clear';

export function isLiteracyKeyboardBoard(board: Pick<Board, 'layout'>): boolean {
  return board.layout === 'literacy-keyboard';
}

export function insertKeyboardChar(utterance: string[], char: string): string[] {
  if (!char) return utterance;
  if (utterance.length === 0) return [char];
  const next = [...utterance];
  const lastIndex = next.length - 1;
  next[lastIndex] = `${next[lastIndex] ?? ''}${char}`;
  return next;
}

export function insertKeyboardSpace(utterance: string[]): string[] {
  if (utterance.length === 0) return utterance;
  const last = utterance[utterance.length - 1] ?? '';
  if (last === '') return utterance;
  return [...utterance, ''];
}

export function keyboardBackspace(utterance: string[]): string[] {
  if (utterance.length === 0) return utterance;
  const next = [...utterance];
  const lastIndex = next.length - 1;
  const last = next[lastIndex] ?? '';
  if (last.length > 0) {
    next[lastIndex] = last.slice(0, -1);
    if (next[lastIndex] === '' && next.length > 1) {
      next.pop();
    }
    return next;
  }
  return next.slice(0, -1);
}

export function formatKeyboardUtterance(utterance: string[]): string {
  return utterance.join(' ').trim();
}

export function applyKeyboardActivation(
  utterance: string[],
  button: BoardButton,
): { utterance: string[]; action: 'edit' | 'speak' | 'none' } {
  if (button.kind !== 'analytic' || !button.keyboardRole) {
    return { utterance, action: 'none' };
  }

  switch (button.keyboardRole) {
    case 'char':
      return { utterance: insertKeyboardChar(utterance, button.speechText), action: 'edit' };
    case 'space':
      return { utterance: insertKeyboardSpace(utterance), action: 'edit' };
    case 'backspace':
      return { utterance: keyboardBackspace(utterance), action: 'edit' };
    case 'clear':
      return { utterance: [], action: 'edit' };
    default:
      return { utterance, action: 'none' };
  }
}

export function isKeyboardSpeakButton(button: BoardButton): boolean {
  return button.kind === 'analytic' && button.id === 'key-speak';
}
