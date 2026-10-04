import type { BoardButton } from '@voxa/core';
import { MULBERRY_SYMBOL_BASE } from '@voxa/core';

/** True when any of `buttons` renders a vendored Mulberry symbol (CC BY-SA 4.0 requires credit). */
export function showsMulberrySymbols(buttons: readonly BoardButton[]): boolean {
  return buttons.some(
    (button) =>
      button.symbolRef?.provider === 'mulberry' ||
      Boolean(button.symbolUrl?.startsWith(`${MULBERRY_SYMBOL_BASE}/`)),
  );
}
