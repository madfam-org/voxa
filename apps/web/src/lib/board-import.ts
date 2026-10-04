import type { BoardImportFormat } from '@voxa/sync';

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
