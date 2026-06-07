import type { BoardButton } from '@voxa/core';
import type { SymbolPrediction, TextPrediction } from './index.js';

const CORE_CONTINUATIONS: Record<string, string[]> = {
  i: ['want', 'need', 'go', 'like'],
  want: ['more', 'to go', 'help', 'eat'],
  go: ['home', 'school', 'now', 'outside'],
  help: ['me', 'please'],
  more: ['please', 'food', 'play'],
};

export function buildTextPredictions(partialText: string, maxSuggestions = 3): TextPrediction[] {
  const trimmed = partialText.trim();
  if (!trimmed) return [];

  const words = trimmed.toLowerCase().split(/\s+/);
  const lastWord = words[words.length - 1] ?? '';
  const continuations = CORE_CONTINUATIONS[lastWord] ?? [];

  const phraseSuggestions = continuations.map((next) => {
    const prefix = words.slice(0, -1).join(' ');
    const text = prefix ? `${prefix} ${next}` : next.charAt(0).toUpperCase() + next.slice(1);
    return { text, confidence: 0.82 };
  });

  const templates: TextPrediction[] = [
    ...phraseSuggestions,
    { text: `${trimmed} please`, confidence: 0.74 },
    { text: `${trimmed} now`, confidence: 0.7 },
  ];

  const seen = new Set<string>();
  return templates
    .filter((s) => s.text.toLowerCase() !== trimmed.toLowerCase())
    .filter((s) => {
      if (seen.has(s.text)) return false;
      seen.add(s.text);
      return true;
    })
    .slice(0, maxSuggestions);
}

export function buildSymbolPredictions(
  recentButtonIds: string[],
  buttons: BoardButton[],
  maxSuggestions = 3,
): SymbolPrediction[] {
  if (recentButtonIds.length === 0) return [];

  const byId = new Map(buttons.map((b) => [b.id as string, b]));
  const last = byId.get(recentButtonIds[recentButtonIds.length - 1] ?? '');
  if (!last) return [];

  const lastWord = (last.kind === 'analytic' ? last.label : last.phrase).toLowerCase();
  const nextWords = CORE_CONTINUATIONS[lastWord] ?? ['more', 'please', 'help'];

  return buttons
    .filter((b) => {
      const label = (b.kind === 'analytic' ? b.label : b.phrase).toLowerCase();
      return nextWords.some((w) => label.startsWith(w) || label === w);
    })
    .slice(0, maxSuggestions)
    .map((b) => ({
      symbolId: b.id as string,
      label: b.kind === 'analytic' ? b.label : b.phrase,
      confidence: 0.75,
    }));
}
