import type { ObzExportOptions, ObzImageLoader } from '@voxa/obf';
import { MULBERRY_ASSET_BASE } from '@voxa/symbols';
import { getMediaAsset } from './media-store.js';

/**
 * Origin that serves the vendored Mulberry SVGs (the web app's /public).
 * Staging may point at production: the files are identical, public and
 * immutable per release.
 */
export function webBaseUrl(): string {
  return (process.env.VOXA_WEB_BASE_URL ?? 'https://voxa.madfam.io').replace(/\/+$/, '');
}

const MAX_SVG_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;

interface LoaderDeps {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  getMedia?: typeof getMediaAsset;
  databaseUrl?: string;
  warn?: (message: string) => void;
}

/**
 * Loads image bytes for an OBZ export of `boardId`:
 * - Mulberry SVGs from the web origin (fixed path prefix, path validated by
 *   `@voxa/symbols`, so this cannot be pointed at another host);
 * - photos uploaded to this API for the same board, read from the media store.
 * Nothing else is ever fetched. Failures are logged and the image stays a URL
 * reference inside the archive.
 */
export function createObzImageLoader(boardId: string, deps: LoaderDeps = {}): ObzImageLoader {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const baseUrl = (deps.baseUrl ?? webBaseUrl()).replace(/\/+$/, '');
  const getMedia = deps.getMedia ?? getMediaAsset;
  const databaseUrl = deps.databaseUrl ?? process.env.DATABASE_URL;
  const warn = deps.warn ?? ((message: string) => console.warn(message));

  return async (source) => {
    if (source.kind === 'mulberry' && source.mulberryPath) {
      const url = `${baseUrl}${MULBERRY_ASSET_BASE}/${source.mulberryPath}`;
      try {
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || !type.includes('svg')) {
          warn(`[obz-export] Mulberry SVG unavailable (${res.status} ${type}): ${source.mulberryPath}`);
          return null;
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength > MAX_SVG_BYTES) {
          warn(`[obz-export] Mulberry SVG too large (${bytes.byteLength} B): ${source.mulberryPath}`);
          return null;
        }
        return { bytes, contentType: 'image/svg+xml' };
      } catch (err) {
        warn(`[obz-export] Mulberry SVG fetch failed: ${source.mulberryPath}: ${(err as Error).message}`);
        return null;
      }
    }

    if (source.kind === 'media' && source.mediaId) {
      try {
        const asset = await getMedia(databaseUrl, source.mediaId);
        if (!asset || asset.boardId !== boardId || !asset.mimeType.startsWith('image/')) return null;
        return { bytes: new Uint8Array(asset.data), contentType: asset.mimeType };
      } catch (err) {
        warn(`[obz-export] media ${source.mediaId} unreadable: ${(err as Error).message}`);
        return null;
      }
    }

    return null;
  };
}

/** Export options used by the board stores. */
export function obzExportOptions(boardId: string): ObzExportOptions {
  return { assetBaseUrl: webBaseUrl(), loadImage: createObzImageLoader(boardId) };
}
