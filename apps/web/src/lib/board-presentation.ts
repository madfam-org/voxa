import {
  applyCoreSymbols,
  DEMO_BOARD_ID,
  localizeBoardContent,
  type Board,
  type StarterContentLocale,
} from '@voxa/core';
import { contentLocaleForUi, isUiLocale, DEFAULT_UI_LOCALE } from '@voxa/i18n';

/**
 * Board as shown on screen. The shared demo board is stored once (in the
 * source vocabulary, possibly with symbols from an earlier release); for
 * display it gets the current core symbol allow-map and, outside the editor,
 * the viewer's UI language (es -> es-MX). Every other board is shown as stored.
 */
export function presentBoardForDisplay(
  board: Board,
  options: { boardId: string; isEditor: boolean; uiLocale: string },
): Board {
  if (options.boardId !== DEMO_BOARD_ID) return board;
  const withSymbols = applyCoreSymbols(board);
  if (options.isEditor) return withSymbols;
  const ui = isUiLocale(options.uiLocale) ? options.uiLocale : DEFAULT_UI_LOCALE;
  return localizeBoardContent(withSymbols, contentLocaleForUi(ui) as StarterContentLocale);
}
