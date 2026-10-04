import { VoxaSyncError, type BoardImportFormat } from '@voxa/sync';

export type { BoardImportFormat };

/**
 * Grid 3, TD Snap and TouchChat imports are beta: they import the words of
 * one page (no pictures, no links to other pages). The import UI says so.
 */
export const BETA_IMPORT_FORMATS: ReadonlySet<BoardImportFormat> = new Set(['gridset', 'snap', 'touchchat']);

const CONTENT_LOCALE_BY_UI: Record<string, string> = { es: 'es-MX', en: 'en-US', fr: 'fr-FR' };

/** Content locale sent with an import, used only for files that carry none (Spanish-first). */
export function contentLocaleForUi(uiLocale: string): string {
  return CONTENT_LOCALE_BY_UI[uiLocale.slice(0, 2).toLowerCase()] ?? 'es-MX';
}

/**
 * How an import failure is shown. A 402 means the plan's board limit is
 * reached (imports always create a board): the import UI explains the limit
 * and offers export and delete, instead of a generic error. `limit` is the
 * number of boards the plan allows, when the API said so.
 */
export type ImportFailure = { kind: 'board-limit'; limit?: number } | { kind: 'error'; message: string };

export function classifyImportFailure(err: unknown): ImportFailure {
  if (err instanceof VoxaSyncError && err.status === 402) {
    const limit = err.body.limit;
    return typeof limit === 'number' && Number.isInteger(limit) && limit > 0
      ? { kind: 'board-limit', limit }
      : { kind: 'board-limit' };
  }
  return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
}
