import type { Board, BoardButton } from '@voxa/core';
import { isLiteracyKeyboardBoard } from '@voxa/core';
import { mulberryPathFromUrl, resolveButtonSymbolUrl } from '@voxa/symbols';

/**
 * Absolute image URI for a button's symbol, or `undefined` for a label-only
 * button. Same resolution as the web board (`resolveButtonSymbolUrl`): Mulberry
 * references resolve to the vendored SVGs the web host serves under
 * `/symbols/mulberry/`, and removed-library symbols resolve to nothing.
 * Relative paths are joined to `webUrl`; only http(s) URLs are returned.
 */
export function buttonSymbolUri(btn: BoardButton, webUrl: string): string | undefined {
  const url = resolveButtonSymbolUrl(btn.symbolUrl, btn.symbolRef);
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return `${webUrl.replace(/\/+$/, '')}${url}`;
  return undefined;
}

/** Literacy keyboards and boards set to hide symbols render labels only, as on the web. */
export function boardHidesSymbols(board: Board): boolean {
  return isLiteracyKeyboardBoard(board) || board.display?.hideSymbols === true;
}

/** True when any of the given symbol URIs is a vendored Mulberry symbol (attribution needed). */
export function showsMulberrySymbol(uris: readonly (string | undefined)[]): boolean {
  return uris.some((uri) => uri !== undefined && mulberryPathFromUrl(uri) !== undefined);
}
