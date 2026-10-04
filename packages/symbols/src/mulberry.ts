import type { MulberrySymbolRef } from '@voxa/core';

/**
 * Mulberry Symbols source.
 *
 * Mulberry Symbols (© Steve Lee, https://mulberrysymbols.org) are licensed
 * CC BY-SA 4.0, which permits commercial use with attribution and
 * share-alike. They are Voxa's symbol library.
 *
 * The SVGs are vendored locally (not hotlinked) under the web app's public dir
 * so the app ships its own copy with the required attribution. See
 * `apps/web/public/symbols/mulberry/ATTRIBUTION.md` and the `/legal/symbols`
 * page.
 */

/** Public path prefix under which the vendored Mulberry SVGs are served. */
export const MULBERRY_ASSET_BASE = '/symbols/mulberry';

export const MULBERRY_SITE_URL = 'https://mulberrysymbols.org';
export const MULBERRY_SOURCE_URL = 'https://github.com/mulberrysymbols/mulberry-symbols';
export const MULBERRY_AUTHOR = 'Steve Lee';
export const MULBERRY_LICENSE_NAME = 'CC BY-SA 4.0';
export const MULBERRY_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

/** Credit line returned with every symbol search (English; the UI localizes its own). */
export const MULBERRY_ATTRIBUTION =
  'Mulberry Symbols © Steve Lee (mulberrysymbols.org), licensed CC BY-SA 4.0. https://creativecommons.org/licenses/by-sa/4.0/';

/** OBF `license` object for a Mulberry image (Open Board Format 3.x image entry). */
export const MULBERRY_OBF_LICENSE = {
  type: MULBERRY_LICENSE_NAME,
  copyright_notice_url: MULBERRY_LICENSE_URL,
  source_url: MULBERRY_SITE_URL,
  author_name: MULBERRY_AUTHOR,
  author_url: MULBERRY_SOURCE_URL,
} as const;

/**
 * Curated map from Voxa "Core" concept slugs to the slug-named Mulberry SVGs
 * vendored beside the full set (`<slug>.svg`, byte-identical to upstream files
 * listed in ATTRIBUTION.md). Boards created before the full set was vendored
 * reference these slugs.
 */
export const MULBERRY_CORE_SLUGS = {
  i: 'i',
  want: 'want',
  more: 'more',
  go: 'go',
  help: 'help',
  eat: 'eat',
  drink: 'drink',
  wait: 'wait',
  look: 'look',
  listen: 'listen',
  come: 'come',
  turn: 'turn',
  put: 'put',
  get: 'get',
  make: 'make',
  see: 'see',
  good: 'good',
  bad: 'bad',
  up: 'up',
  down: 'down',
  in: 'in',
  out: 'out',
  on: 'on',
  off: 'off',
  school: 'school',
  home: 'home',
} as const satisfies Record<string, string>;

export type MulberryCoreSlug = keyof typeof MULBERRY_CORE_SLUGS;

/**
 * Upstream file names are `EN/<stem>.svg` where the stem uses letters, digits
 * and `_ , . ( ) -` only (checked for all 3,436 files). Anything else is
 * rejected so a stored reference can never become a path traversal or an
 * arbitrary URL.
 */
const MULBERRY_FILE_PATTERN = /^EN\/[A-Za-z0-9_,.()-]+\.svg$/;

/** True when `file` is a well-formed path inside the vendored full set. */
export function isMulberryFile(file: string): boolean {
  return MULBERRY_FILE_PATTERN.test(file) && !file.includes('..');
}

/** Web path for a file of the vendored full set, or `undefined` when malformed. */
export function mulberryFileUrl(file: string): string | undefined {
  return isMulberryFile(file) ? `${MULBERRY_ASSET_BASE}/${file}` : undefined;
}

/** True when `slug` has a slug-named core SVG. */
export function hasMulberrySymbol(slug: string): slug is MulberryCoreSlug {
  return Object.prototype.hasOwnProperty.call(MULBERRY_CORE_SLUGS, slug);
}

/** Web path for a slug-named core SVG, or `undefined` when the slug is not a core slug. */
export function mulberryImageUrl(slug: string): string | undefined {
  if (!hasMulberrySymbol(slug)) return undefined;
  return `${MULBERRY_ASSET_BASE}/${MULBERRY_CORE_SLUGS[slug]}.svg`;
}

/** Resolve a Mulberry reference: full-set `file` first, then the core slug map. */
export function resolveMulberrySymbolUrl(ref: MulberrySymbolRef): string | undefined {
  if (ref.file) {
    const url = mulberryFileUrl(ref.file);
    if (url) return url;
  }
  return mulberryImageUrl(ref.slug);
}

const CORE_FILE_PATTERN = /^[a-z]+\.svg$/;

/**
 * Path of a vendored Mulberry SVG relative to {@link MULBERRY_ASSET_BASE}
 * when `url` points at one (relative `/symbols/mulberry/…` or an absolute URL
 * with that path), otherwise `undefined`.
 */
export function mulberryPathFromUrl(url: string): string | undefined {
  let pathname = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      pathname = new URL(url).pathname;
    } catch {
      return undefined;
    }
  }
  const prefix = `${MULBERRY_ASSET_BASE}/`;
  if (!pathname.startsWith(prefix)) return undefined;
  let rest: string;
  try {
    rest = decodeURIComponent(pathname.slice(prefix.length));
  } catch {
    return undefined;
  }
  if (isMulberryFile(rest)) return rest;
  if (CORE_FILE_PATTERN.test(rest) && hasMulberrySymbol(rest.slice(0, -4))) return rest;
  return undefined;
}
