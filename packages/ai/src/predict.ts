import type { BoardButton } from '@voxa/core';
import type { SymbolPrediction, TextPrediction } from './index.js';

/** Languages the local continuation tables cover. */
export type PredictionLanguage = 'en' | 'es';

interface ContinuationTable {
  /** Next words after a given last word. Keys are lowercase without accents. */
  continuations: Record<string, string[]>;
  /** Short endings offered after any utterance, in this language. */
  endings: string[];
  /** Symbols offered when the last symbol has no entry. */
  symbolFallback: string[];
}

const EN: ContinuationTable = {
  continuations: {
    i: ['want', 'need', 'go', 'like'],
    want: ['more', 'to go', 'help', 'eat'],
    go: ['home', 'school', 'now', 'outside'],
    help: ['me', 'please'],
    more: ['please', 'food', 'play'],
  },
  endings: ['please', 'now'],
  symbolFallback: ['more', 'please', 'help'],
};

/**
 * Spanish (es-MX) core-vocabulary continuations.
 *
 * Pending review by a credentialed speech-language pathologist (ruling R89),
 * like the starter-board translations. Keys cover both the board label (often
 * an infinitive such as "querer") and the common first-person form a
 * communicator builds ("quiero"); continuations avoid gendered adjectives.
 */
const ES: ContinuationTable = {
  continuations: {
    yo: ['quiero', 'necesito', 'voy', 'tengo'],
    tu: ['quieres', 'puedes'],
    quiero: ['más', 'comer', 'agua', 'jugar'],
    querer: ['más', 'comer', 'agua', 'jugar'],
    quieres: ['jugar', 'comer'],
    necesito: ['ayuda', 'ir al baño', 'agua'],
    necesitar: ['ayuda', 'ir al baño', 'agua'],
    voy: ['a casa', 'a la escuela', 'al baño', 'afuera'],
    ir: ['a casa', 'a la escuela', 'al baño', 'afuera'],
    puedo: ['ir', 'jugar', 'comer'],
    ayuda: ['por favor'],
    ayudame: ['por favor'],
    mas: ['por favor', 'comida', 'jugar'],
    no: ['quiero', 'me gusta', 'gracias'],
    me: ['gusta', 'duele', 'siento'],
    gusta: ['jugar', 'comer', 'esto'],
    gustar: ['jugar', 'comer', 'esto'],
    tengo: ['hambre', 'sed', 'sueño', 'frío'],
    estoy: ['bien', 'mal', 'feliz', 'triste'],
    otra: ['vez'],
    comer: ['más', 'ahora'],
    beber: ['agua', 'leche'],
  },
  endings: ['por favor', 'ahora'],
  symbolFallback: ['mas', 'por favor', 'ayuda'],
};

const TABLES: Record<PredictionLanguage, ContinuationTable> = { en: EN, es: ES };

/**
 * The continuation table for a board locale. English and Spanish have tables;
 * a missing locale keeps the historical English behaviour, and any other
 * language gets none (an English word inside a French utterance is worse than
 * no suggestion).
 */
export function predictionLanguage(locale?: string): PredictionLanguage | null {
  const lang = (locale ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';
  if (lang === '' || lang === 'en') return 'en';
  if (lang === 'es') return 'es';
  return null;
}

/** Lowercase and strip diacritics, so "Más" and "mas" share a key. */
export function foldWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Text suggestions for the message being built. Each suggestion is the whole
 * utterance with a continuation appended, because the communicator replaces
 * the message with the chosen suggestion.
 */
export function buildTextPredictions(
  partialText: string,
  maxSuggestions = 3,
  locale?: string,
): TextPrediction[] {
  const trimmed = partialText.trim().replace(/\s+/g, ' ');
  if (!trimmed) return [];

  const language = predictionLanguage(locale);
  if (!language) return [];
  const table = TABLES[language];

  const words = trimmed.split(' ');
  const lastWord = foldWord(words[words.length - 1] ?? '');
  const continuations = table.continuations[lastWord] ?? [];

  const candidates: TextPrediction[] = [
    ...continuations.map((next) => ({ text: `${trimmed} ${next}`, confidence: 0.82 })),
    ...table.endings
      .filter((ending) => !foldWord(trimmed).endsWith(foldWord(ending)))
      .map((ending, i) => ({ text: `${trimmed} ${ending}`, confidence: i === 0 ? 0.74 : 0.7 })),
  ];

  const seen = new Set<string>();
  return candidates
    .filter((s) => {
      const key = foldWord(s.text);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxSuggestions);
}

function buttonWord(button: BoardButton): string {
  return button.kind === 'analytic' ? button.label : button.phrase;
}

export function buildSymbolPredictions(
  recentButtonIds: string[],
  buttons: BoardButton[],
  maxSuggestions = 3,
  locale?: string,
): SymbolPrediction[] {
  if (recentButtonIds.length === 0) return [];

  const byId = new Map(buttons.map((b) => [b.id as string, b]));
  const last = byId.get(recentButtonIds[recentButtonIds.length - 1] ?? '');
  if (!last) return [];

  const language = predictionLanguage(locale ?? last.locale);
  if (!language) return [];
  const table = TABLES[language];

  const lastWord = foldWord(buttonWord(last));
  const nextWords = (table.continuations[lastWord] ?? table.symbolFallback).map(foldWord);

  return buttons
    .filter((b) => {
      const label = foldWord(buttonWord(b));
      return nextWords.some((w) => label.startsWith(w));
    })
    .slice(0, maxSuggestions)
    .map((b) => ({
      symbolId: b.id as string,
      label: buttonWord(b),
      confidence: 0.75,
    }));
}
