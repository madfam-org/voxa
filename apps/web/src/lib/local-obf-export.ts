import type { Board } from '@voxa/core';
import { serializeObf, voxaBoardToObf } from '@voxa/obf';

/** Serialize the in-memory board as OBF when the export API is unreachable. */
export function exportBoardObfJson(board: Board): string {
  return serializeObf(voxaBoardToObf(board));
}
