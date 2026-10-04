import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Locale-independent accessible names for the signed-in specs.
 *
 * `/app` follows the UI language (Spanish by default, then English and
 * French), so a selector that hard-codes the English label clicks nothing on a
 * Spanish page. `ui('common.save')` returns a pattern that matches the label in
 * every catalog the web app ships (`packages/i18n/messages/*.json`), so the
 * same spec passes whatever language the page renders in.
 *
 * Labels the app still renders as literal English text (not from a catalog)
 * are the same in every locale and stay plain strings in the specs.
 */

const LOCALES = ['es', 'en', 'fr'] as const;
const MESSAGES_DIR = path.resolve(__dirname, '../../packages/i18n/messages');

type Catalog = Record<string, unknown>;

const catalogs: Record<(typeof LOCALES)[number], Catalog> = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as Catalog,
  ]),
) as Record<(typeof LOCALES)[number], Catalog>;

function lookup(catalog: Catalog, key: string): string | undefined {
  let node: unknown = catalog;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every catalog's text for `key`. Throws when no catalog has it (a typo or a removed key). */
export function uiTexts(key: string): string[] {
  const texts = new Set<string>();
  for (const locale of LOCALES) {
    const text = lookup(catalogs[locale], key);
    if (text) texts.add(text);
  }
  if (texts.size === 0) {
    throw new Error(`i18n key "${key}" is missing from every catalog in ${MESSAGES_DIR}`);
  }
  return [...texts];
}

/**
 * A pattern matching the catalog text for `key` in any locale.
 *
 * By default it matches the whole accessible name (case-insensitive), so a short
 * label such as "Audit" cannot also hit "Auditory beep". Pass `{ exact: false }`
 * for a case-insensitive substring match, which is what Playwright's string
 * `name` option does (useful for labels that wrap extra hint text).
 */
export function ui(key: string, options: { exact?: boolean } = {}): RegExp {
  const alternatives = uiTexts(key).map(escapeRegExp).join('|');
  return (options.exact ?? true) ? new RegExp(`^(?:${alternatives})$`, 'i') : new RegExp(`(?:${alternatives})`, 'i');
}
