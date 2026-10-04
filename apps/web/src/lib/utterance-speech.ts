import {
  boardContentLocale,
  formatKeyboardUtterance,
  isLiteracyKeyboardBoard,
  type Board,
} from '@voxa/core';
import { contentLocaleForUi, isUiLocale, DEFAULT_UI_LOCALE } from '@voxa/i18n';
import { applySpanishAgreement } from '@voxa/vocabulary';
import { speakText } from './play-button-speech';

/**
 * Voice locale for free-text speech on `board`: the board's own content
 * locale (most common button locale), else the content locale of the UI
 * language. Never a hard-coded English default.
 */
export function speechLocaleForBoard(board: Pick<Board, 'grid'>, uiLocale: string): string {
  return (
    boardContentLocale(board) ??
    contentLocaleForUi(isUiLocale(uiLocale) ? uiLocale : DEFAULT_UI_LOCALE)
  );
}

/** Text of the whole message bar for `board` (keyboard boards join typed words). */
export function wholeMessageText(board: Pick<Board, 'layout'>, utterance: string[]): string {
  return isLiteracyKeyboardBoard(board) ? formatKeyboardUtterance(utterance) : utterance.join(' ');
}

export interface ComposeMessageOptions {
  /** Apply Spanish agreement on es-* boards (default true). False keeps the base forms. */
  agreement?: boolean;
}

export interface ComposedMessage {
  /** Text shown in the message bar and spoken by "Speak". */
  text: string;
  /** The words exactly as tapped (base forms). */
  baseText: string;
  /** True when agreement changed at least one word, so a "keep base form" choice is meaningful. */
  agreementApplied: boolean;
}

/** Lower-cased speech texts of the board's buttons tagged with `pos`. */
function wordsTagged(board: Pick<Board, 'grid'>, pos: 'verb' | 'adjective'): Set<string> {
  const words = new Set<string>();
  for (const button of board.grid.buttons) {
    if (button.kind !== 'analytic' || button.partOfSpeech !== pos) continue;
    words.add(button.speechText.trim().toLowerCase());
    words.add(button.label.trim().toLowerCase());
  }
  return words;
}

/**
 * Compose the message bar for `board`: on Spanish boards the words agree with
 * their subject pronoun ("yo querer beber" → "yo quiero beber"; rule in
 * docs/linguistic-framework.md, "Spanish morphology"); other locales and keyboard boards keep the
 * words as tapped. Pure: no speech, no state.
 */
export function composeMessage(
  board: Pick<Board, 'grid' | 'layout'>,
  utterance: string[],
  uiLocale: string,
  options: ComposeMessageOptions = {},
): ComposedMessage {
  const baseText = wholeMessageText(board, utterance);
  const agreement = options.agreement ?? true;
  if (
    !agreement ||
    isLiteracyKeyboardBoard(board) ||
    !speechLocaleForBoard(board, uiLocale).toLowerCase().startsWith('es')
  ) {
    return { text: baseText, baseText, agreementApplied: false };
  }
  const verbs = wordsTagged(board, 'verb');
  const adjectives = wordsTagged(board, 'adjective');
  const result = applySpanishAgreement(utterance, {
    isVerb: (word) => verbs.has(word.trim().toLowerCase()),
    isAdjective: (word) => adjectives.has(word.trim().toLowerCase()),
  });
  if (!result.changed) return { text: baseText, baseText, agreementApplied: false };
  return { text: result.words.join(' '), baseText, agreementApplied: true };
}

/** Speak the whole message bar in the board's content locale. Returns false when empty. */
export function speakWholeMessage(
  board: Pick<Board, 'grid' | 'layout'>,
  utterance: string[],
  uiLocale: string,
  options: ComposeMessageOptions = {},
): boolean {
  const { text } = composeMessage(board, utterance, uiLocale, options);
  if (!text) return false;
  speakText(text, speechLocaleForBoard(board, uiLocale));
  return true;
}
