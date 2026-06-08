import { createBoardId, createButtonId, type BoardButton } from '@voxa/core';
import { type ObfBoard } from '@voxa/obf';
import { strFromU8, unzipSync } from 'fflate';

export interface GridsetCell {
  x: number;
  y: number;
  label: string;
  vocalization: string;
  navigateToGridId?: string;
}

export interface GridsetPage {
  id: string;
  name: string;
  rows: number;
  columns: number;
  cells: GridsetCell[];
}

export interface GridsetParseResult {
  pages: GridsetPage[];
  warnings: string[];
}

function countTag(xml: string, tag: string): number {
  return (xml.match(new RegExp(`<${tag}[\\s/>]`, 'g')) ?? []).length;
}

export function parseGridXml(xml: string, gridId: string): GridsetPage {
  const rows = countTag(xml, 'RowDefinition') || 1;
  const columns = countTag(xml, 'ColumnDefinition') || 1;
  const name = xml.match(/<Grid[^>]*\bName="([^"]*)"/)?.[1] ?? gridId;
  const cells: GridsetCell[] = [];

  const cellRe = /<Cell\b([^>]*)>([\s\S]*?)<\/Cell>/g;
  let match = cellRe.exec(xml);
  while (match) {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    const x = Number(attrs.match(/\bX="(\d+)"/)?.[1] ?? 0);
    const y = Number(attrs.match(/\bY="(\d+)"/)?.[1] ?? 0);
    const caption = body.match(/<Caption>([^<]*)<\/Caption>/)?.[1]?.trim();
    if (caption) {
      const navigateToGridId = body
        .match(/Jump\.To[\s\S]*?Parameter[^>]*Key="grid"[^>]*>([^<]+)/)?.[1]
        ?.trim();
      cells.push({
        x,
        y,
        label: caption,
        vocalization: caption,
        navigateToGridId: navigateToGridId || undefined,
      });
    }
    match = cellRe.exec(xml);
  }

  return { id: gridId, name, rows, columns, cells };
}

export function parseGridsetArchive(bytes: Uint8Array): GridsetParseResult {
  const warnings: string[] = [];
  const entries = unzipSync(bytes);
  const pages: GridsetPage[] = [];

  for (const [path, data] of Object.entries(entries)) {
    if (!path.includes('Grids/') || !path.endsWith('/grid.xml')) continue;
    const gridId = path.split('/').slice(-2, -1)[0] ?? 'grid';
    pages.push(parseGridXml(strFromU8(data), gridId));
  }

  pages.sort((a, b) => a.name.localeCompare(b.name));

  if (pages.length === 0) {
    throw new Error('Invalid gridset: expected Grids/*/grid.xml entries in archive.');
  }

  if (pages.some((page) => page.cells.length === 0)) {
    warnings.push('One or more grids had no speakable cells; empty grids were skipped in counts.');
  }

  return { pages, warnings };
}

export function gridsetPrimaryPageToObf(
  pages: GridsetPage[],
  boardId: string,
): { board: ObfBoard; warnings: string[] } {
  const page = pages[0];
  if (!page) {
    throw new Error('Gridset has no importable grids.');
  }
  const warnings: string[] = [];
  if (pages.length > 1) {
    warnings.push(
      `Gridset contains ${pages.length} grids; imported primary grid "${page.name}" only.`,
    );
  }

  const buttons = page.cells.map((cell, index) => ({
    id: `grid-${cell.x}-${cell.y}-${index}`,
    label: cell.label,
    vocalization: cell.vocalization,
    load_board_id: cell.navigateToGridId,
  }));

  return {
    board: {
      format: 'open-board-format',
      formatVersion: '3.0',
      id: boardId,
      name: page.name,
      grid: { rows: page.rows, columns: page.columns, order: 'row-major' },
      buttons,
    },
    warnings,
  };
}

/** Preserve Grid X/Y positions (column/row) instead of flattening to row-major OBF order. */
export function gridsetPageToBoardButtons(page: GridsetPage): BoardButton[] {
  return page.cells.map((cell, index) => {
    const base = {
      kind: 'analytic' as const,
      id: createButtonId(`grid-${cell.x}-${cell.y}-${index}`),
      label: cell.label,
      speechText: cell.vocalization,
      locale: 'en-US',
      position: { row: cell.y, column: cell.x },
      locked: false,
    };

    if (cell.navigateToGridId) {
      return {
        ...base,
        navigateToBoardId: createBoardId(cell.navigateToGridId),
      };
    }

    return base;
  });
}
