import type { Board, BoardButton } from '@voxa/core';
import { fitzgeraldColor, resolvePartOfSpeech } from '@voxa/vocabulary';
import { buttonImageSource, obfImageFor, type ExportImageSource, type ObfImage } from './images.js';

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
  images?: ObfImage[];
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

/**
 * URL for a button's `image_id`: the referenced `images[]` entry (`data`,
 * then `url`) when the board has one, else the legacy convention where
 * `image_id` itself is a URL or archive path.
 */
export function obfButtonImageUrl(obf: ObfBoard, imageId: string | undefined): string | undefined {
  if (!imageId) return undefined;
  const image = obf.images?.find((entry) => entry.id === imageId);
  if (image) return image.data ?? image.url ?? image.path;
  return imageId;
}

/** Map OBF buttons into Voxa grid positions (row-major) */
export function obfToVoxaButtons(obf: ObfBoard): BoardButton[] {
  const { rows, columns } = obf.grid;
  return obf.buttons.slice(0, rows * columns).map((btn, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const label = btn.label ?? btn.vocalization ?? '…';
    const partOfSpeech = resolvePartOfSpeech(
      { kind: 'analytic', label, partOfSpeech: undefined },
      btn.border_color,
    );

    const base = {
      kind: 'analytic' as const,
      id: btn.id as BoardButton['id'],
      label,
      speechText: btn.vocalization ?? label,
      symbolUrl: obfButtonImageUrl(obf, btn.image_id),
      locale: 'en-US',
      position: { row, column },
      locked: false,
      partOfSpeech,
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

export interface ObfExportOptions {
  /**
   * Origin that serves the vendored Mulberry SVGs (e.g. `https://voxa.madfam.io`).
   * Without it, Mulberry image URLs stay relative (`/symbols/mulberry/…`).
   */
  assetBaseUrl?: string;
}

/** OBF board plus the export source of each image entry (by image id). */
export interface ObfExport {
  board: ObfBoard;
  sources: Map<string, ExportImageSource>;
}

function sortedButtons(board: Board): BoardButton[] {
  return [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );
}

/**
 * Build an OBF board with spec-shaped `images[]`. Mulberry images carry an OBF
 * `license` object; pictures from the removed non-commercial library are never
 * emitted (those buttons export label-only).
 */
export function voxaBoardToObfWithSources(board: Board, options: ObfExportOptions = {}): ObfExport {
  const { rows, columns } = board.grid;
  const images: ObfImage[] = [];
  const sources = new Map<string, ExportImageSource>();
  const idByUrl = new Map<string, string>();

  const imageIdFor = (btn: BoardButton): string | undefined => {
    const source = buttonImageSource(btn);
    if (!source) return undefined;
    const key = source.kind === 'mulberry' ? `mulberry:${source.mulberryPath}` : source.url;
    const existing = idByUrl.get(key);
    if (existing) return existing;
    const id = `image-${images.length + 1}`;
    idByUrl.set(key, id);
    sources.set(id, source);
    images.push(obfImageFor(id, source, options));
    return id;
  };

  const buttons = sortedButtons(board).map((btn) => {
    const imageId = imageIdFor(btn);
    return {
      id: btn.id as string,
      label: btn.kind === 'analytic' ? btn.label : btn.phrase,
      vocalization: btn.kind === 'analytic' ? btn.speechText : btn.phrase,
      ...(imageId ? { image_id: imageId } : {}),
      border_color: fitzgeraldColor(resolvePartOfSpeech(btn)),
      ...(btn.navigateToBoardId ? { load_board_id: btn.navigateToBoardId as string } : {}),
    };
  });

  return {
    board: {
      format: 'open-board-format',
      formatVersion: '3.0',
      id: board.id as string,
      name: board.name,
      grid: { rows, columns, order: 'row-major' },
      buttons,
      images,
    },
    sources,
  };
}

export function voxaBoardToObf(board: Board, options: ObfExportOptions = {}): ObfBoard {
  return voxaBoardToObfWithSources(board, options).board;
}

export function serializeObf(board: ObfBoard): string {
  return JSON.stringify(board, null, 2);
}

/** .obz is a zip archive of OBF JSON + embedded images — see `./obz.js` */
export type ObzArchive = {
  boardJson: string;
  mediaPaths: string[];
};

export {
  buttonImageSource,
  classifyImageUrl,
  extensionForContentType,
  obfImageFor,
  type ExportImageKind,
  type ExportImageSource,
  type ObfImage,
  type ObfLicense,
} from './images.js';

export {
  obfToVoxaButtonsWithImages,
  obzToVoxaButtons,
  packObz,
  resolveObfImageUrl,
  unpackObz,
  voxaBoardToObz,
  type ObzExportOptions,
  type ObzImageLoader,
  type ObzLoadedImage,
  type ObzUnpackResult,
} from './obz.js';
