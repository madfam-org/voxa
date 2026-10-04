import {
  createBoardId,
  createButtonId,
  createProfileId,
  type Board,
  type BoardButton,
} from './index.js';
import type { StarterContentLocale } from './demo-locale.js';
import type { KeyboardRole } from './keyboard-input.js';

interface KeySpec {
  id: string;
  label: string;
  speech: string;
  role: KeyboardRole;
  pos?: 'noun' | 'preposition';
}

const COMMAND_LABELS: Record<StarterContentLocale, { space: string; speak: string; clear: string }> = {
  'en-US': { space: 'Space', speak: 'Speak', clear: 'Clear' },
  'es-MX': { space: 'Espacio', speak: 'Hablar', clear: 'Borrar' },
  'fr-FR': { space: 'Espace', speak: 'Parler', clear: 'Effacer' },
};

/**
 * Extra letter row for languages whose alphabet goes beyond plain QWERTY.
 * Key ids are ASCII so they stay stable across locales.
 */
const EXTRA_LETTER_ROW: Partial<Record<StarterContentLocale, Array<{ id: string; char: string }>>> = {
  'es-MX': [
    { id: 'key-a-acute', char: 'á' },
    { id: 'key-e-acute', char: 'é' },
    { id: 'key-i-acute', char: 'í' },
    { id: 'key-o-acute', char: 'ó' },
    { id: 'key-u-acute', char: 'ú' },
    { id: 'key-u-diaeresis', char: 'ü' },
    { id: 'key-n-tilde', char: 'ñ' },
    { id: 'key-inverted-question', char: '¿' },
    { id: 'key-inverted-exclaim', char: '¡' },
  ],
  'fr-FR': [
    { id: 'key-e-acute', char: 'é' },
    { id: 'key-e-grave', char: 'è' },
    { id: 'key-e-circumflex', char: 'ê' },
    { id: 'key-a-grave', char: 'à' },
    { id: 'key-a-circumflex', char: 'â' },
    { id: 'key-c-cedilla', char: 'ç' },
    { id: 'key-u-grave', char: 'ù' },
    { id: 'key-o-circumflex', char: 'ô' },
    { id: 'key-i-circumflex', char: 'î' },
    { id: 'key-e-diaeresis', char: 'ë' },
  ],
};

function keyButtonFor(spec: KeySpec, row: number, column: number, locale: StarterContentLocale): BoardButton {
  return {
    kind: 'analytic',
    id: createButtonId(spec.id),
    label: spec.label,
    speechText: spec.speech,
    keyboardRole: spec.role,
    locale,
    position: { row, column },
    locked: false,
    partOfSpeech: spec.pos,
  };
}

/**
 * QWERTY literacy keyboard — 4×10 text keys for literate AAC users. For
 * `es-MX` and `fr-FR` a fifth row adds the language's accented letters (and ñ,
 * ¿, ¡ for Spanish) and the command keys are labelled in that language.
 */
export function createLiteracyKeyboardBoard(options?: {
  boardId?: string;
  name?: string;
  profileId?: string;
  locale?: StarterContentLocale;
}): Board {
  const locale = options?.locale ?? 'en-US';
  const labels = COMMAND_LABELS[locale] ?? COMMAND_LABELS['en-US'];
  const extraRow = EXTRA_LETTER_ROW[locale] ?? [];
  const bottomRow = extraRow.length > 0 ? 4 : 3;
  const keyButton = (spec: KeySpec, row: number, column: number): BoardButton =>
    keyButtonFor(spec, row, column, locale);
  const letter = (id: string, label: string, row: number, column: number): BoardButton =>
    keyButton({ id, label, speech: label, role: 'char' }, row, column);
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

  extraRow.forEach((key, column) => {
    buttons.push(letter(key.id, key.char.toUpperCase(), 3, column));
  });

  buttons.push(
    keyButton({ id: 'key-space', label: labels.space, speech: ' ', role: 'space', pos: 'preposition' }, bottomRow, 0),
    keyButton({ id: 'key-apostrophe', label: "'", speech: "'", role: 'char' }, bottomRow, 1),
    keyButton({ id: 'key-exclaim', label: '!', speech: '!', role: 'char' }, bottomRow, 2),
    keyButton({ id: 'key-dash', label: '-', speech: '-', role: 'char' }, bottomRow, 3),
    keyButton({ id: 'key-speak', label: labels.speak, speech: '', role: 'char' }, bottomRow, 7),
    keyButton({ id: 'key-clear', label: labels.clear, speech: '', role: 'clear' }, bottomRow, 8),
    keyButton({ id: 'key-backspace-row', label: '⌫', speech: '', role: 'backspace' }, bottomRow, 9),
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
      rows: bottomRow + 1,
      columns: 10,
      buttons,
    },
  };
}
