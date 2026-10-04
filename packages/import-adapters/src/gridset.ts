import { createBoardId, createButtonId, type BoardButton } from '@voxa/core';
import { normalizeObfLocale, safeUnzip } from '@voxa/obf';
import { strFromU8 } from 'fflate';

/**
 * Grid 3 `.gridset` import (BETA — imports the words of one page).
 *
 * A gridset is a zip with one `Grids/<grid name>/grid.xml` per page and a
 * `Settings0/settings.xml` whose `<StartGrid>` names the home grid. Voxa
 * imports the home grid's captions at their X/Y positions; pictures, other
 * pages and commands other than "jump to grid" are not imported. Tested on
 * synthetic archives that mirror that structure (no proprietary sample files).
 */
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
  /** The home grid named by `<StartGrid>`, or the first grid when the gridset has none. */
  home: GridsetPage;
  /** Locale from the gridset settings, when present. */
  locale?: string;
  warnings: string[];
}

function countTag(xml: string, tag: string): number {
  return (xml.match(new RegExp(`<${tag}[\\s/>]`, 'g')) ?? []).length;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
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
    // Grid 3 omits X/Y when they are 0.
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
        label: decodeXml(caption),
        vocalization: decodeXml(caption),
        navigateToGridId: navigateToGridId ? decodeXml(navigateToGridId) : undefined,
      });
    }
    match = cellRe.exec(xml);
  }

  return { id: gridId, name: decodeXml(name), rows, columns, cells };
}

/** `<StartGrid>` and a language/locale value from `Settings0/settings.xml`, when present. */
export function parseGridsetSettings(xml: string): { startGrid?: string; locale?: string } {
  const startGrid = xml.match(/<StartGrid>([^<]+)<\/StartGrid>/)?.[1]?.trim();
  const rawLocale =
    xml.match(/<(?:Language|Locale|LanguageCode)>([^<]+)<\/(?:Language|Locale|LanguageCode)>/)?.[1] ??
    xml.match(/<GridSetSettings\b[^>]*\bxml:lang="([^"]+)"/)?.[1];
  return {
    ...(startGrid ? { startGrid: decodeXml(startGrid) } : {}),
    ...(normalizeObfLocale(rawLocale) ? { locale: normalizeObfLocale(rawLocale) } : {}),
  };
}

export function parseGridsetArchive(bytes: Uint8Array): GridsetParseResult {
  const warnings: string[] = [];
  const entries = safeUnzip(bytes);
  const pages: GridsetPage[] = [];
  let settings: { startGrid?: string; locale?: string } = {};

  for (const [path, data] of entries) {
    if (/^Settings0\/settings\.xml$/i.test(path)) {
      settings = parseGridsetSettings(strFromU8(data));
      continue;
    }
    if (!path.includes('Grids/') || !path.endsWith('/grid.xml')) continue;
    const gridId = path.split('/').slice(-2, -1)[0] ?? 'grid';
    pages.push(parseGridXml(strFromU8(data), gridId));
  }

  pages.sort((a, b) => a.name.localeCompare(b.name));

  if (pages.length === 0) {
    throw new Error('Invalid gridset: expected Grids/*/grid.xml entries in archive.');
  }

  let home = settings.startGrid
    ? pages.find((page) => page.id === settings.startGrid || page.name === settings.startGrid)
    : undefined;
  if (!home) {
    home = pages[0]!;
    warnings.push(
      settings.startGrid
        ? `Start grid "${settings.startGrid}" is not in the gridset; imported "${home.name}".`
        : `The gridset names no start grid; imported "${home.name}".`,
    );
  }
  if (pages.length > 1) {
    warnings.push(`Gridset contains ${pages.length} grids; imported the home grid "${home.name}" only (beta).`);
  }
  if (home.cells.length === 0) {
    warnings.push(`The home grid "${home.name}" has no captions to import.`);
  }

  return { pages, home, ...(settings.locale ? { locale: settings.locale } : {}), warnings };
}

/** Preserve Grid X/Y positions (column/row). */
export function gridsetPageToBoardButtons(page: GridsetPage, locale = 'es-MX'): BoardButton[] {
  return page.cells.map((cell, index) => {
    const base = {
      kind: 'analytic' as const,
      id: createButtonId(`grid-${cell.x}-${cell.y}-${index}`),
      label: cell.label,
      speechText: cell.vocalization,
      locale,
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
