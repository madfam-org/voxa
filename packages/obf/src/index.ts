import type { Board, BoardButton } from '@voxa/core';

/**
 * Minimal OBF 3.x board shape for interchange.
 * Full spec: https://www.openboardformat.org/
 */
export interface ObfBoard {
  format: 'open-board-format';
  formatVersion: '3.0';
  id: string;
  name: string;
  grid: {
    rows: number;
    columns: number;
    order: 'row-major' | 'column-major';
  };
  buttons: ObfButton[];
}

export interface ObfButton {
  id: string;
  label?: string;
  vocalization?: string;
  image_id?: string;
  background_color?: string;
  border_color?: string;
  parent_id?: string;
  load_board_id?: string;
}

export interface ObfParseResult {
  board: ObfBoard;
  warnings: string[];
}

export function parseObfJson(raw: string): ObfParseResult {
  const warnings: string[] = [];
  const parsed = JSON.parse(raw) as ObfBoard;

  if (parsed.format !== 'open-board-format') {
    warnings.push('Missing or unknown OBF format marker; treating as best-effort import.');
  }

  if (!parsed.grid || !Array.isArray(parsed.buttons)) {
    throw new Error('Invalid OBF document: requires grid and buttons array.');
  }

  return { board: parsed, warnings };
}

/** Map OBF buttons into Voxa grid positions (row-major) */
export function obfToVoxaButtons(obf: ObfBoard): BoardButton[] {
  const { rows, columns } = obf.grid;
  return obf.buttons.slice(0, rows * columns).map((btn, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const label = btn.label ?? btn.vocalization ?? '…';

    const base = {
      kind: 'analytic' as const,
      id: btn.id as BoardButton['id'],
      label,
      speechText: btn.vocalization ?? label,
      symbolUrl: btn.image_id,
      locale: 'en-US',
      position: { row, column },
      locked: false,
    };

    if (btn.load_board_id) {
      return {
        ...base,
        navigateToBoardId: btn.load_board_id as BoardButton['navigateToBoardId'],
      };
    }

    return base;
  });
}

export function voxaBoardToObf(board: Board): ObfBoard {
  const { rows, columns } = board.grid;
  const sorted = [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );

  return {
    format: 'open-board-format',
    formatVersion: '3.0',
    id: board.id as string,
    name: board.name,
    grid: { rows, columns, order: 'row-major' },
    buttons: sorted.map((btn) => ({
      id: btn.id as string,
      label: btn.kind === 'analytic' ? btn.label : btn.phrase,
      vocalization: btn.kind === 'analytic' ? btn.speechText : btn.phrase,
      image_id: btn.symbolUrl,
      ...(btn.navigateToBoardId ? { load_board_id: btn.navigateToBoardId as string } : {}),
    })),
  };
}

export function serializeObf(board: ObfBoard): string {
  return JSON.stringify(board, null, 2);
}

/** .obz is a zip archive of OBF + media — extraction deferred to platform layer */
export type ObzArchive = {
  boardJson: string;
  mediaPaths: string[];
};
