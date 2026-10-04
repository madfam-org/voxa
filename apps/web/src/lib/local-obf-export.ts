import type { Board } from '@voxa/core';
import { serializeObf, voxaBoardToObf } from '@voxa/obf';

/** Serialize the in-memory board as OBF when the export API is unreachable. */
export function exportBoardObfJson(board: Board, assetBaseUrl = currentOrigin()): string {
  return serializeObf(voxaBoardToObf(board, { assetBaseUrl }));
}

/** Absolute Mulberry image URLs need the web origin that serves them. */
function currentOrigin(): string | undefined {
  return typeof window === 'undefined' ? undefined : window.location.origin;
}
