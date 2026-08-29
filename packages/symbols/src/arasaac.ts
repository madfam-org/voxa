/** Identifies which source a symbol came from. */
export type SymbolSource = 'arasaac' | 'mulberry';

export interface SymbolSearchHit {
  /** Numeric ARASAAC pictogram id, or string concept slug for local sources. */
  id: number | string;
  keyword: string;
  imageUrl: string;
  source: SymbolSource;
  tags: string[];
}

export interface SearchSymbolsOptions {
  locale?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
}

const ARASAAC_API = 'https://api.arasaac.org/v1';
const ARASAAC_STATIC = 'https://static.arasaac.org/pictograms';

interface ArasaacKeyword {
  keyword?: string;
}

interface ArasaacPictogram {
  _id: number;
  keywords?: ArasaacKeyword[];
  tags?: string[];
}

export function arasaacImageUrl(pictogramId: number, size: 300 | 500 = 300): string {
  return `${ARASAAC_STATIC}/${pictogramId}/${pictogramId}_${size}.png`;
}

export async function searchArasaac(
  query: string,
  options: SearchSymbolsOptions = {},
): Promise<SymbolSearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const locale = (options.locale ?? 'en').toLowerCase();
  const limit = Math.min(24, Math.max(1, options.limit ?? 12));
  const fetchFn = options.fetchImpl ?? fetch;

  const url = `${ARASAAC_API}/pictograms/${encodeURIComponent(locale)}/search/${encodeURIComponent(trimmed)}`;
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`ARASAAC search failed: ${res.status}`);
  }

  const body = (await res.json()) as ArasaacPictogram[] | { error?: unknown };
  if (!Array.isArray(body)) {
    throw new Error('ARASAAC search returned unexpected payload');
  }

  return body.slice(0, limit).map((item) => {
    const keyword = item.keywords?.[0]?.keyword ?? trimmed;
    return {
      id: item._id,
      keyword,
      imageUrl: arasaacImageUrl(item._id),
      source: 'arasaac' as const,
      tags: item.tags ?? [],
    };
  });
}
