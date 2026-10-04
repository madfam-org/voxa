/** Identifies which library a symbol came from. Mulberry is the only one Voxa serves. */
export type SymbolSource = 'mulberry';

export interface SymbolSearchHit {
  /** Mulberry index slug (stable, URL-safe). */
  id: string;
  /** Best matching keyword in the requested language, for titles and alt text. */
  keyword: string;
  /** Path on the web origin, e.g. `/symbols/mulberry/EN/water.svg`. */
  imageUrl: string;
  source: SymbolSource;
  /** Upstream file under the vendored Mulberry directory, e.g. `EN/water.svg`. */
  file: string;
  category: string;
  tags: string[];
}

export interface SearchSymbolsOptions {
  /** `es`, `en` or `fr` (region suffixes such as `es-MX` are accepted). */
  locale?: string;
  limit?: number;
}
