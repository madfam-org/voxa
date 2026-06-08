import type { PartOfSpeechTag, SpeechForm } from '@voxa/core';

export type InflectionKind =
  | 'base'
  | 'third-person'
  | 'progressive'
  | 'past'
  | 'plural'
  | 'irregular';

interface InflectionEntry {
  pos: PartOfSpeechTag[];
  forms: Array<{ kind: InflectionKind; label: string; speechText: string }>;
}

/** Core AAC vocabulary inflection hints (English). Not exhaustive — editors can add custom forms. */
const CORE_INFLECTIONS: Record<string, InflectionEntry> = {
  go: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'goes', speechText: 'goes' },
      { kind: 'progressive', label: 'going', speechText: 'going' },
      { kind: 'past', label: 'went', speechText: 'went' },
    ],
  },
  eat: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'eats', speechText: 'eats' },
      { kind: 'progressive', label: 'eating', speechText: 'eating' },
      { kind: 'past', label: 'ate', speechText: 'ate' },
    ],
  },
  drink: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'drinks', speechText: 'drinks' },
      { kind: 'progressive', label: 'drinking', speechText: 'drinking' },
      { kind: 'past', label: 'drank', speechText: 'drank' },
    ],
  },
  want: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'wants', speechText: 'wants' },
      { kind: 'progressive', label: 'wanting', speechText: 'wanting' },
      { kind: 'past', label: 'wanted', speechText: 'wanted' },
    ],
  },
  help: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'helps', speechText: 'helps' },
      { kind: 'progressive', label: 'helping', speechText: 'helping' },
      { kind: 'past', label: 'helped', speechText: 'helped' },
    ],
  },
  stop: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'stops', speechText: 'stops' },
      { kind: 'progressive', label: 'stopping', speechText: 'stopping' },
      { kind: 'past', label: 'stopped', speechText: 'stopped' },
    ],
  },
  play: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'plays', speechText: 'plays' },
      { kind: 'progressive', label: 'playing', speechText: 'playing' },
      { kind: 'past', label: 'played', speechText: 'played' },
    ],
  },
  like: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'likes', speechText: 'likes' },
      { kind: 'progressive', label: 'liking', speechText: 'liking' },
      { kind: 'past', label: 'liked', speechText: 'liked' },
    ],
  },
  see: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'sees', speechText: 'sees' },
      { kind: 'progressive', label: 'seeing', speechText: 'seeing' },
      { kind: 'past', label: 'saw', speechText: 'saw' },
    ],
  },
  do: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'does', speechText: 'does' },
      { kind: 'progressive', label: 'doing', speechText: 'doing' },
      { kind: 'past', label: 'did', speechText: 'did' },
    ],
  },
  have: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'has', speechText: 'has' },
      { kind: 'progressive', label: 'having', speechText: 'having' },
      { kind: 'past', label: 'had', speechText: 'had' },
    ],
  },
  be: {
    pos: ['verb'],
    forms: [
      { kind: 'third-person', label: 'is', speechText: 'is' },
      { kind: 'progressive', label: 'being', speechText: 'being' },
      { kind: 'past', label: 'was', speechText: 'was' },
    ],
  },
  friend: {
    pos: ['noun'],
    forms: [{ kind: 'plural', label: 'friends', speechText: 'friends' }],
  },
  home: {
    pos: ['noun'],
    forms: [{ kind: 'plural', label: 'homes', speechText: 'homes' }],
  },
};

function normalizeLemma(text: string): string {
  return text.trim().toLowerCase().split(/\s+/)[0] ?? text;
}

export function suggestInflections(
  lemma: string,
  partOfSpeech: PartOfSpeechTag | undefined,
): SpeechForm[] {
  const key = normalizeLemma(lemma);
  const entry = CORE_INFLECTIONS[key];
  if (!entry) return [];
  if (partOfSpeech && !entry.pos.includes(partOfSpeech)) return [];

  return entry.forms.map((form) => ({
    id: `${key}-${form.kind}`,
    label: form.label,
    speechText: form.speechText,
  }));
}

export function mergeSpeechForms(existing: SpeechForm[] | undefined, incoming: SpeechForm[]): SpeechForm[] {
  const merged = [...(existing ?? [])];
  for (const form of incoming) {
    if (merged.some((item) => item.id === form.id || item.speechText === form.speechText)) continue;
    merged.push(form);
  }
  return merged;
}
