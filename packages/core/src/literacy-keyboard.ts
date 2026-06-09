import {
  createBoardId,
  createButtonId,
  createProfileId,
  type Board,
  type BoardButton,
} from './index.js';
import type { KeyboardRole } from './keyboard-input.js';

interface KeySpec {
  id: string;
  label: string;
  speech: string;
  role: KeyboardRole;
  pos?: 'noun' | 'preposition';
}

function keyButton(spec: KeySpec, row: number, column: number): BoardButton {
  return {
    kind: 'analytic',
    id: createButtonId(spec.id),
    label: spec.label,
    speechText: spec.speech,
    keyboardRole: spec.role,
    locale: 'en-US',
    position: { row, column },
    locked: false,
    partOfSpeech: spec.pos,
  };
}

function letter(id: string, label: string, row: number, column: number): BoardButton {
  return keyButton({ id, label, speech: label, role: 'char' }, row, column);
}

/** QWERTY literacy keyboard — 4×10 text keys for literate AAC users. */
export function createLiteracyKeyboardBoard(options?: {
  boardId?: string;
  name?: string;
  profileId?: string;
}): Board {
  const buttons: BoardButton[] = [];
  const row0 = 'qwertyuiop'.split('');
  row0.forEach((char, column) => {
    buttons.push(letter(`key-${char}`, char.toUpperCase(), 0, column));
  });

  const row1 = 'asdfghjkl'.split('');
  row1.forEach((char, column) => {
    buttons.push(letter(`key-${char}`, char.toUpperCase(), 1, column));
  });
  buttons.push(
    keyButton({ id: 'key-backspace', label: '⌫', speech: '', role: 'backspace' }, 1, 9),
  );

  'zxcvbnm'.split('').forEach((char, index) => {
    buttons.push(letter(`key-${char}`, char.toUpperCase(), 2, index));
  });
  buttons.push(
    keyButton({ id: 'key-comma', label: ',', speech: ',', role: 'char', pos: 'preposition' }, 2, 7),
    keyButton({ id: 'key-period', label: '.', speech: '.', role: 'char', pos: 'preposition' }, 2, 8),
    keyButton({ id: 'key-question', label: '?', speech: '?', role: 'char', pos: 'preposition' }, 2, 9),
  );

  buttons.push(
    keyButton({ id: 'key-space', label: 'Space', speech: ' ', role: 'space', pos: 'preposition' }, 3, 0),
    keyButton({ id: 'key-apostrophe', label: "'", speech: "'", role: 'char' }, 3, 1),
    keyButton({ id: 'key-exclaim', label: '!', speech: '!', role: 'char' }, 3, 2),
    keyButton({ id: 'key-dash', label: '-', speech: '-', role: 'char' }, 3, 3),
    keyButton({ id: 'key-speak', label: 'Speak', speech: '', role: 'char' }, 3, 7),
    keyButton({ id: 'key-clear', label: 'Clear', speech: '', role: 'clear' }, 3, 8),
    keyButton({ id: 'key-backspace-row', label: '⌫', speech: '', role: 'backspace' }, 3, 9),
  );

  return {
    id: createBoardId(options?.boardId ?? 'starter-literacy-keyboard'),
    name: options?.name ?? 'Literacy Keyboard',
    profileId: createProfileId(options?.profileId ?? 'default'),
    layout: 'literacy-keyboard',
    version: 1,
    updatedAt: new Date().toISOString(),
    display: { hideSymbols: true },
    grid: {
      rows: 4,
      columns: 10,
      buttons,
    },
  };
}
