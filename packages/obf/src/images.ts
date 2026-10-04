import type { BoardButton } from '@voxa/core';
import {
  isRemovedSymbolRef,
  isRemovedSymbolUrl,
  MULBERRY_ASSET_BASE,
  MULBERRY_OBF_LICENSE,
  mulberryPathFromUrl,
  resolveButtonSymbolUrl,
} from '@voxa/symbols';

/** OBF 3.x image licence object. */
export interface ObfLicense {
  type: string;
  copyright_notice_url?: string;
  source_url?: string;
  author_name?: string;
  author_url?: string;
}

/** OBF 3.x image entry (`board.images[]`, referenced by `button.image_id`). */
export interface ObfImage {
  id: string;
  url?: string;
  data?: string;
  path?: string;
  content_type?: string;
  width?: number;
  height?: number;
  license?: ObfLicense;
}

/**
 * Where a button's picture comes from, for export:
 * - `mulberry`: a vendored Mulberry SVG (CC BY-SA 4.0, carries a licence)
 * - `data`: an inline image the user supplied (data: URL)
 * - `media`: a photo the user uploaded to the Voxa API (`/v1/media/<id>`)
 * - `external`: any other http(s) URL (e.g. from an imported board); referenced, never fetched
 */
export type ExportImageKind = 'mulberry' | 'data' | 'media' | 'external';

export interface ExportImageSource {
  kind: ExportImageKind;
  /** URL as the board stores or resolves it. */
  url: string;
  contentType?: string;
  /** Mulberry only: file path under the vendored directory (`EN/water.svg`). */
  mulberryPath?: string;
  /** Media only: the media asset id. */
  mediaId?: string;
}

const DATA_IMAGE = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,/i;
const MEDIA_PATH = /(?:^|\/)v1\/media\/([A-Za-z0-9-]{1,64})$/;

function mediaIdFromUrl(url: string): string | undefined {
  let pathname = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      pathname = new URL(url).pathname;
    } catch {
      return undefined;
    }
  }
  return MEDIA_PATH.exec(pathname)?.[1];
}

/** Classify an image URL for export; `undefined` means "export no image". */
export function classifyImageUrl(url: string | undefined): ExportImageSource | undefined {
  if (!url) return undefined;
  // The removed non-commercial library is never exported, fetched or linked.
  if (isRemovedSymbolUrl(url)) return undefined;

  const mulberryPath = mulberryPathFromUrl(url);
  if (mulberryPath) {
    return { kind: 'mulberry', url, mulberryPath, contentType: 'image/svg+xml' };
  }

  const data = DATA_IMAGE.exec(url);
  if (data) return { kind: 'data', url, contentType: data[1]!.toLowerCase() };

  const mediaId = mediaIdFromUrl(url);
  if (mediaId) return { kind: 'media', url, mediaId };

  if (/^https?:\/\//i.test(url)) return { kind: 'external', url };
  return undefined;
}

/** The picture a button shows (same resolution as the communicator), classified for export. */
export function buttonImageSource(btn: BoardButton): ExportImageSource | undefined {
  const symbolRef = btn.kind === 'analytic' || btn.kind === 'glp' ? btn.symbolRef : undefined;
  if (isRemovedSymbolRef(symbolRef)) return undefined;
  return classifyImageUrl(resolveButtonSymbolUrl(btn.symbolUrl, symbolRef));
}

function joinUrl(base: string | undefined, path: string): string {
  if (!base) return path;
  return `${base.replace(/\/+$/, '')}${path}`;
}

/** OBF image entry for a classified source. */
export function obfImageFor(
  id: string,
  source: ExportImageSource,
  options: { assetBaseUrl?: string } = {},
): ObfImage {
  switch (source.kind) {
    case 'mulberry':
      return {
        id,
        url: joinUrl(options.assetBaseUrl, `${MULBERRY_ASSET_BASE}/${source.mulberryPath}`),
        content_type: 'image/svg+xml',
        license: { ...MULBERRY_OBF_LICENSE },
      };
    case 'data':
      return { id, data: source.url, content_type: source.contentType };
    case 'media':
      return { id, url: source.url };
    case 'external':
      return { id, url: source.url };
    default: {
      const _exhaustive: never = source.kind;
      return _exhaustive;
    }
  }
}

export function extensionForContentType(contentType: string | undefined): string {
  switch ((contentType ?? '').toLowerCase()) {
    case 'image/svg+xml':
      return 'svg';
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}
