import type { BoardButton, PartOfSpeechTag } from '@voxa/core';

const FITZGERALD_HEX: Record<PartOfSpeechTag, string> = {
  adjective: '#2563eb',
  verb: '#16a34a',
  pronoun: '#eab308',
  noun: '#ea580c',
  preposition: '#db2777',
  conjunction: '#ffffff',
};

const LABEL_POS: Record<string, PartOfSpeechTag> = {
  i: 'pronoun',
  me: 'pronoun',
  my: 'pronoun',
  mine: 'pronoun',
  you: 'pronoun',
  your: 'pronoun',
  we: 'pronoun',
  us: 'pronoun',
  they: 'pronoun',
  them: 'pronoun',
  he: 'pronoun',
  she: 'pronoun',
  it: 'pronoun',
  want: 'verb',
  go: 'verb',
  help: 'verb',
  stop: 'verb',
  eat: 'verb',
  drink: 'verb',
  like: 'verb',
  play: 'verb',
  see: 'verb',
  look: 'verb',
  do: 'verb',
  make: 'verb',
  come: 'verb',
  more: 'preposition',
  in: 'preposition',
  on: 'preposition',
  up: 'preposition',
  out: 'preposition',
  with: 'preposition',
  to: 'preposition',
  for: 'preposition',
  and: 'conjunction',
  or: 'conjunction',
  but: 'conjunction',
  home: 'noun',
  school: 'noun',
  friend: 'noun',
  water: 'noun',
  food: 'noun',
  bathroom: 'noun',
  big: 'adjective',
  little: 'adjective',
  happy: 'adjective',
  sad: 'adjective',
  good: 'adjective',
  bad: 'adjective',
};

function normalizeHex(color: string): string | undefined {
  const trimmed = color.trim().toLowerCase();
  if (!trimmed) return undefined;
  const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(hex)) return undefined;
  const expanded =
    hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex;
  return `#${expanded}`;
}

/** Map OBF / legacy border colors back to Fitzgerald POS when possible. */
export function partOfSpeechFromBorderColor(color: string | undefined): PartOfSpeechTag | undefined {
  if (!color) return undefined;
  const normalized = normalizeHex(color);
  if (!normalized) return undefined;

  for (const [pos, hex] of Object.entries(FITZGERALD_HEX) as Array<[PartOfSpeechTag, string]>) {
    if (normalizeHex(hex) === normalized) return pos;
  }

  return undefined;
}

export function guessPartOfSpeechFromLabel(label: string): PartOfSpeechTag | undefined {
  const token = label.trim().toLowerCase().replace(/[^a-z']/g, '');
  if (!token) return undefined;
  return LABEL_POS[token];
}

export function resolvePartOfSpeech(
  button: Pick<BoardButton, 'partOfSpeech' | 'kind'> & { label?: string; phrase?: string },
  borderColor?: string,
): PartOfSpeechTag {
  if (button.partOfSpeech) return button.partOfSpeech;

  const fromColor = partOfSpeechFromBorderColor(borderColor);
  if (fromColor) return fromColor;

  const text = button.kind === 'analytic' ? button.label : button.phrase;
  const fromLabel = text ? guessPartOfSpeechFromLabel(text) : undefined;
  if (fromLabel) return fromLabel;

  return button.kind === 'glp' ? 'preposition' : 'noun';
}
