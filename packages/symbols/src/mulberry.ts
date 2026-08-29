import type { MulberrySymbolRef } from '@voxa/core';
import type { SearchSymbolsOptions, SymbolSearchHit } from './arasaac.js';

/**
 * Mulberry Symbols source.
 *
 * Mulberry Symbols (© Steve Lee, https://mulberrysymbols.org) are licensed
 * CC BY-SA 4.0, which — unlike ARASAAC's CC BY-NC-SA — permits commercial use.
 * That makes Mulberry the commercially-clean default imagery source for Voxa.
 *
 * The SVGs are vendored locally (not hotlinked) under the web app's public dir
 * so the app ships its own copy with the required attribution. See
 * `apps/web/public/symbols/mulberry/ATTRIBUTION.md`.
 */

/** Public path prefix under which the vendored Mulberry SVGs are served. */
export const MULBERRY_ASSET_BASE = '/symbols/mulberry';

/**
 * Curated map from Voxa "Core" concept slugs (see `CORE_SYMBOL_IDS` in
 * `@voxa/core`) to the vendored Mulberry SVG basename (without extension).
 *
 * Each vendored file is named by its Voxa slug (`<slug>.svg`) rather than the
 * upstream Mulberry filename, so the mapping value equals the slug. Keeping the
 * map explicit documents coverage and lets us diverge from 1:1 slug↔file naming
 * if needed later. Slugs that Mulberry has no good match for are intentionally
 * absent (ARASAAC still covers them); see the source's coverage notes.
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

/** True when `slug` has a vendored Mulberry SVG available. */
export function hasMulberrySymbol(slug: string): slug is MulberryCoreSlug {
  return Object.prototype.hasOwnProperty.call(MULBERRY_CORE_SLUGS, slug);
}

/**
 * Build the local URL for a vendored Mulberry SVG by concept slug.
 * Returns `undefined` when no vendored symbol exists for the slug.
 */
export function mulberryImageUrl(slug: string): string | undefined {
  if (!hasMulberrySymbol(slug)) return undefined;
  return `${MULBERRY_ASSET_BASE}/${MULBERRY_CORE_SLUGS[slug]}.svg`;
}

/**
 * Resolve a Mulberry symbol reference to a local URL.
 * Returns `undefined` when the referenced slug is not vendored.
 */
export function resolveMulberrySymbolUrl(ref: MulberrySymbolRef): string | undefined {
  return mulberryImageUrl(ref.slug);
}

/**
 * Search the vendored Mulberry Core set by concept slug (offline / local-only).
 * Mirrors the shape of `searchArasaac` so callers can treat sources uniformly,
 * but resolves entirely from the local map — no network request.
 */
export function searchMulberry(
  query: string,
  options: SearchSymbolsOptions = {},
): SymbolSearchHit[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const limit = Math.min(24, Math.max(1, options.limit ?? 12));

  return Object.keys(MULBERRY_CORE_SLUGS)
    .filter((slug) => slug.includes(trimmed))
    .slice(0, limit)
    .map((slug) => ({
      id: slug,
      keyword: slug,
      imageUrl: mulberryImageUrl(slug)!,
      source: 'mulberry' as const,
      tags: [],
    }));
}
