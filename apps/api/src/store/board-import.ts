import { randomUUID } from 'node:crypto';
import { createBoardId, createProfileId, type Board, type BoardButton } from '@voxa/core';
import {
  gridsetArchiveToBoardUpdate,
  snapArchiveToBoardUpdate,
  touchChatArchiveToBoardUpdate,
} from '@voxa/import-adapters';
import {
  ObfImportError,
  obfSetFromJson,
  obfSetToVoxaBoards,
  unpackObz,
  type ImportedMedia,
  type ObfBoardSet,
  type ObfImportSkipped,
} from '@voxa/obf';

/** Formats `POST /v1/boards/import/:format` accepts. */
export const IMPORT_FORMATS = ['obf', 'obz', 'gridset', 'snap', 'touchchat'] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

/** Grid 3, TD Snap and TouchChat imports are beta: they import the words of one page. */
export const BETA_IMPORT_FORMATS: ReadonlySet<ImportFormat> = new Set(['gridset', 'snap', 'touchchat']);

/** Largest upload the import endpoint reads (archives are checked again entry by entry). */
export const MAX_IMPORT_BYTES = 30 * 1024 * 1024;

export function isImportFormat(value: string): value is ImportFormat {
  return (IMPORT_FORMATS as readonly string[]).includes(value);
}

export interface ImportContext {
  /** Locale for files that carry none. */
  fallbackLocale: string;
  /** Called with the number of boards the import will create, before anything is stored. */
  reserve: (boardCount: number) => Promise<void> | void;
  /** Stores embedded media for a new board; returns its URL, or undefined to skip it. */
  storeMedia: (media: ImportedMedia) => Promise<string | undefined>;
  /** True when a link to an existing board id may be kept (the importer can open that board). */
  keepExternalLink: (boardId: string) => boolean;
  newBoardId?: () => string;
}

export interface ImportPlan {
  boards: Board[];
  rootBoardId: string;
  warnings: string[];
  skipped: ObfImportSkipped;
  beta: boolean;
}

function newBoardId(): string {
  return `board-${randomUUID()}`;
}

function textOf(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/** Adapter errors are plain `Error`s; anything they throw is a bad file (400). */
async function adapter<T>(run: () => Promise<T> | T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ObfImportError) throw err;
    throw new ObfImportError((err as Error).message || 'Unreadable file.', 'INVALID_FILE');
  }
}

/** One-page adapters: links to other pages of the source file cannot resolve and are removed. */
function singlePageBoard(
  name: string,
  rows: number,
  columns: number,
  buttons: BoardButton[],
  id: string,
): { board: Board; droppedLinks: number } {
  let droppedLinks = 0;
  const cleaned = buttons.map((btn) => {
    if (!btn.navigateToBoardId) return btn;
    droppedLinks += 1;
    const { navigateToBoardId: _dropped, ...rest } = btn;
    return rest as BoardButton;
  });
  return {
    board: {
      id: createBoardId(id),
      name: name.slice(0, 200) || 'Imported board',
      profileId: createProfileId('default'),
      grid: { rows, columns, buttons: cleaned },
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    droppedLinks,
  };
}

/**
 * Turn an uploaded file into NEW boards. Nothing here reads or writes an
 * existing board: every board gets a fresh id, links between boards of the
 * file are remapped to those ids, and embedded media is stored for the new
 * boards through `ctx.storeMedia`. `ctx.reserve` runs (and may throw, e.g. the
 * plan's board limit) before any media is stored.
 */
export async function planImport(format: ImportFormat, bytes: Uint8Array, ctx: ImportContext): Promise<ImportPlan> {
  if (bytes.byteLength === 0) throw new ObfImportError('The file is empty.', 'INVALID_FILE');
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new ObfImportError(`The file is larger than ${MAX_IMPORT_BYTES / (1024 * 1024)} MB.`, 'ARCHIVE_TOO_LARGE');
  }
  const makeId = ctx.newBoardId ?? newBoardId;

  if (format === 'obf' || format === 'obz') {
    const set: ObfBoardSet = format === 'obf' ? obfSetFromJson(textOf(bytes)) : unpackObz(bytes);
    await ctx.reserve(set.boards.length);
    const result = await obfSetToVoxaBoards(set, {
      newBoardId: () => makeId(),
      storeMedia: ctx.storeMedia,
      keepExternalLink: ctx.keepExternalLink,
      fallbackLocale: ctx.fallbackLocale,
      remoteMedia: 'mulberry-only',
    });
    return { ...result, beta: false };
  }

  const options = { fallbackLocale: ctx.fallbackLocale };
  const page =
    format === 'gridset'
      ? await adapter(() => gridsetArchiveToBoardUpdate(bytes, options))
      : format === 'snap'
        ? await adapter(() => snapArchiveToBoardUpdate(bytes, options))
        : await adapter(() => touchChatArchiveToBoardUpdate(bytes, options));
  await ctx.reserve(1);
  const { board, droppedLinks } = singlePageBoard(
    page.page.name,
    page.page.rows,
    page.page.columns,
    page.buttons,
    makeId(),
  );
  const warnings = [...page.warnings];
  if (droppedLinks > 0) warnings.push(`${droppedLinks} links to other pages were removed (beta: one page only).`);
  return {
    boards: [board],
    rootBoardId: board.id as string,
    warnings,
    skipped: { images: 0, sounds: 0, links: droppedLinks, buttons: 0 },
    beta: true,
  };
}
