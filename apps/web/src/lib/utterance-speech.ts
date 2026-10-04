import {
  boardContentLocale,
  formatKeyboardUtterance,
  isLiteracyKeyboardBoard,
  type Board,
} from '@voxa/core';
import { contentLocaleForUi, isUiLocale, DEFAULT_UI_LOCALE } from '@voxa/i18n';
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

/** Speak the whole message bar in the board's content locale. Returns false when empty. */
export function speakWholeMessage(
  board: Pick<Board, 'grid' | 'layout'>,
  utterance: string[],
  uiLocale: string,
): boolean {
  const text = wholeMessageText(board, utterance);
  if (!text) return false;
  speakText(text, speechLocaleForBoard(board, uiLocale));
  return true;
}
