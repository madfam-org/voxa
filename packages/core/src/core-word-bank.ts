import type { PartOfSpeechTag } from './index.js';

/**
 * The core word bank every Voxa core template is built from: a slug (also the
 * button id and the key of the translation table in `demo-locale.ts` and of
 * the symbol allow-map in `core-symbols.ts`), the en-US source label and
 * speech, the part of speech (which sets the Fitzgerald colour) and whether
 * the slot is motor-plan locked.
 *
 * Status: AWAITS REVIEW BY A CREDENTIALED SPEECH-LANGUAGE PATHOLOGIST, like
 * the translations and the symbol map.
 */
export interface StarterWord {
  id: string;
  label: string;
  speech?: string;
  pos: PartOfSpeechTag;
  locked?: boolean;
}

export const CORE_47_WORDS: StarterWord[] = [
  { id: 'i', label: 'I', speech: 'I', pos: 'pronoun', locked: true },
  { id: 'you', label: 'you', speech: 'you', pos: 'pronoun', locked: true },
  { id: 'want', label: 'want', speech: 'want', pos: 'verb', locked: true },
  { id: 'more', label: 'more', speech: 'more', pos: 'preposition', locked: true },
  { id: 'go', label: 'go', speech: 'go', pos: 'verb', locked: true },
  { id: 'stop', label: 'stop', speech: 'stop', pos: 'verb', locked: true },
  { id: 'help', label: 'help', speech: 'help me', pos: 'verb', locked: true },
  { id: 'eat', label: 'eat', speech: 'eat', pos: 'verb', locked: true },
  { id: 'drink', label: 'drink', speech: 'drink', pos: 'verb', locked: true },
  { id: 'yes', label: 'yes', speech: 'yes', pos: 'social', locked: true },
  { id: 'no', label: 'no', speech: 'no', pos: 'social', locked: true },
  { id: 'please', label: 'please', speech: 'please', pos: 'social', locked: true },
  { id: 'like', label: 'like', speech: 'like', pos: 'verb' },
  { id: 'dont', label: "don't", speech: "don't", pos: 'verb' },
  { id: 'different', label: 'different', speech: 'different', pos: 'adjective' },
  { id: 'again', label: 'again', speech: 'again', pos: 'preposition' },
  { id: 'all-done', label: 'all done', speech: 'all done', pos: 'preposition' },
  { id: 'wait', label: 'wait', speech: 'wait', pos: 'verb' },
  { id: 'look', label: 'look', speech: 'look', pos: 'verb' },
  { id: 'listen', label: 'listen', speech: 'listen', pos: 'verb' },
  { id: 'come', label: 'come', speech: 'come', pos: 'verb' },
  { id: 'turn', label: 'turn', speech: 'turn', pos: 'verb' },
  { id: 'put', label: 'put', speech: 'put', pos: 'verb' },
  { id: 'get', label: 'get', speech: 'get', pos: 'verb' },
  { id: 'make', label: 'make', speech: 'make', pos: 'verb' },
  { id: 'do', label: 'do', speech: 'do', pos: 'verb' },
  { id: 'see', label: 'see', speech: 'see', pos: 'verb' },
  { id: 'feel', label: 'feel', speech: 'feel', pos: 'verb' },
  { id: 'good', label: 'good', speech: 'good', pos: 'adjective' },
  { id: 'bad', label: 'bad', speech: 'bad', pos: 'adjective' },
  { id: 'sorry', label: 'sorry', speech: 'sorry', pos: 'social' },
  { id: 'thank-you', label: 'thank you', speech: 'thank you', pos: 'social' },
  { id: 'me', label: 'me', speech: 'me', pos: 'pronoun' },
  { id: 'my', label: 'my', speech: 'my', pos: 'pronoun' },
  { id: 'it', label: 'it', speech: 'it', pos: 'pronoun' },
  { id: 'that', label: 'that', speech: 'that', pos: 'pronoun' },
  { id: 'this', label: 'this', speech: 'this', pos: 'pronoun' },
  { id: 'here', label: 'here', speech: 'here', pos: 'preposition' },
  { id: 'there', label: 'there', speech: 'there', pos: 'preposition' },
  { id: 'up', label: 'up', speech: 'up', pos: 'preposition' },
  { id: 'down', label: 'down', speech: 'down', pos: 'preposition' },
  { id: 'in', label: 'in', speech: 'in', pos: 'preposition' },
  { id: 'out', label: 'out', speech: 'out', pos: 'preposition' },
  { id: 'on', label: 'on', speech: 'on', pos: 'preposition' },
  { id: 'off', label: 'off', speech: 'off', pos: 'preposition' },
  { id: 'home', label: 'home', speech: 'home', pos: 'noun' },
  { id: 'school', label: 'school', speech: 'school', pos: 'noun' },
];

export const CORE_100_EXTRA: StarterWord[] = [
  { id: 'play', label: 'play', speech: 'play', pos: 'verb' },
  { id: 'read', label: 'read', speech: 'read', pos: 'verb' },
  { id: 'write', label: 'write', speech: 'write', pos: 'verb' },
  { id: 'walk', label: 'walk', speech: 'walk', pos: 'verb' },
  { id: 'run', label: 'run', speech: 'run', pos: 'verb' },
  { id: 'sit', label: 'sit', speech: 'sit', pos: 'verb' },
  { id: 'stand', label: 'stand', speech: 'stand', pos: 'verb' },
  { id: 'open', label: 'open', speech: 'open', pos: 'verb' },
  { id: 'close', label: 'close', speech: 'close', pos: 'verb' },
  { id: 'sleep', label: 'sleep', speech: 'sleep', pos: 'verb' },
  { id: 'wash', label: 'wash', speech: 'wash', pos: 'verb' },
  { id: 'bathroom', label: 'bathroom', speech: 'bathroom', pos: 'noun' },
  { id: 'food', label: 'food', speech: 'food', pos: 'noun' },
  { id: 'water', label: 'water', speech: 'water', pos: 'noun' },
  { id: 'milk', label: 'milk', speech: 'milk', pos: 'noun' },
  { id: 'snack', label: 'snack', speech: 'snack', pos: 'noun' },
  { id: 'mom', label: 'mom', speech: 'mom', pos: 'noun' },
  { id: 'dad', label: 'dad', speech: 'dad', pos: 'noun' },
  { id: 'friend', label: 'friend', speech: 'friend', pos: 'noun' },
  { id: 'teacher', label: 'teacher', speech: 'teacher', pos: 'noun' },
  { id: 'happy', label: 'happy', speech: 'happy', pos: 'adjective' },
  { id: 'sad', label: 'sad', speech: 'sad', pos: 'adjective' },
  { id: 'mad', label: 'mad', speech: 'mad', pos: 'adjective' },
  { id: 'scared', label: 'scared', speech: 'scared', pos: 'adjective' },
  { id: 'sick', label: 'sick', speech: 'sick', pos: 'adjective' },
  { id: 'hurt', label: 'hurt', speech: 'hurt', pos: 'adjective' },
  { id: 'big', label: 'big', speech: 'big', pos: 'adjective' },
  { id: 'little', label: 'little', speech: 'little', pos: 'adjective' },
  { id: 'hot', label: 'hot', speech: 'hot', pos: 'adjective' },
  { id: 'cold', label: 'cold', speech: 'cold', pos: 'adjective' },
  { id: 'love', label: 'love', speech: 'love', pos: 'verb' },
  { id: 'hug', label: 'hug', speech: 'hug', pos: 'verb' },
  { id: 'share', label: 'share', speech: 'share', pos: 'verb' },
  { id: 'ask', label: 'ask', speech: 'ask', pos: 'verb' },
  { id: 'tell', label: 'tell', speech: 'tell', pos: 'verb' },
  { id: 'show', label: 'show', speech: 'show', pos: 'verb' },
  { id: 'give', label: 'give', speech: 'give', pos: 'verb' },
  { id: 'take', label: 'take', speech: 'take', pos: 'verb' },
  { id: 'find', label: 'find', speech: 'find', pos: 'verb' },
  { id: 'fix', label: 'fix', speech: 'fix', pos: 'verb' },
  { id: 'clean', label: 'clean', speech: 'clean', pos: 'verb' },
  { id: 'car', label: 'car', speech: 'car', pos: 'noun' },
  { id: 'work', label: 'work', speech: 'work', pos: 'noun' },
  { id: 'outside', label: 'outside', speech: 'outside', pos: 'preposition' },
  { id: 'inside', label: 'inside', speech: 'inside', pos: 'preposition' },
  { id: 'who', label: 'who', speech: 'who', pos: 'pronoun' },
  { id: 'what', label: 'what', speech: 'what', pos: 'pronoun' },
  { id: 'where', label: 'where', speech: 'where', pos: 'pronoun' },
  { id: 'when', label: 'when', speech: 'when', pos: 'pronoun' },
  { id: 'why', label: 'why', speech: 'why', pos: 'pronoun' },
  { id: 'how', label: 'how', speech: 'how', pos: 'pronoun' },
  { id: 'because', label: 'because', speech: 'because', pos: 'conjunction' },
  { id: 'and', label: 'and', speech: 'and', pos: 'conjunction' },
];

const BY_SLUG: ReadonlyMap<string, StarterWord> = new Map(
  [...CORE_47_WORDS, ...CORE_100_EXTRA].map((word) => [word.id, word]),
);

/** The word-bank entry for a slug, or `undefined` for a slug outside the bank. */
export function coreWord(slug: string): StarterWord | undefined {
  return BY_SLUG.get(slug);
}
