import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Board, BoardButton } from '@voxa/core';
import { extensionForContentType, type ExportImageSource } from './images.js';
import {
  obfToVoxaButtons,
  parseObfJson,
  serializeObf,
  voxaBoardToObfWithSources,
  type ObfBoard,
  type ObfExportOptions,
} from './index.js';

const BOARD_ENTRY = 'board.json';

export interface ObzUnpackResult {
  board: ObfBoard;
  images: Map<string, Uint8Array>;
  warnings: string[];
}

function normalizeZipPath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\\/g, '/');
}

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function bytesToDataUrl(path: string, bytes: Uint8Array): string {
  return `data:${mimeFromPath(path)};base64,${uint8ToBase64(bytes)}`;
}

function decodeDataUrl(url: string): Uint8Array | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(url);
  if (!match?.[2]) return null;
  const base64 = match[2];
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function packObz(boardJson: string, images: Record<string, Uint8Array>): Uint8Array {
  const files: Record<string, Uint8Array> = {
    [BOARD_ENTRY]: strToU8(boardJson),
  };
  for (const [path, bytes] of Object.entries(images)) {
    files[normalizeZipPath(path)] = bytes;
  }
  return zipSync(files);
}

export function unpackObz(bytes: Uint8Array): ObzUnpackResult {
  const warnings: string[] = [];
  const entries = unzipSync(bytes);
  const normalized = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(entries)) {
    normalized.set(normalizeZipPath(path), data);
  }

  let boardJson: string | undefined;
  if (normalized.has(BOARD_ENTRY)) {
    boardJson = strFromU8(normalized.get(BOARD_ENTRY)!);
  } else {
    const jsonPath = [...normalized.keys()].find((path) => path.endsWith('.json') && !path.includes('/'));
    if (jsonPath) {
      boardJson = strFromU8(normalized.get(jsonPath)!);
      warnings.push(`Using ${jsonPath} as board manifest (expected ${BOARD_ENTRY}).`);
    }
  }

  if (!boardJson) {
    throw new Error('Invalid OBZ archive: missing board.json');
  }

  const { board, warnings: parseWarnings } = parseObfJson(boardJson);
  warnings.push(...parseWarnings);

  const images = new Map<string, Uint8Array>();
  for (const [path, data] of normalized.entries()) {
    if (path === BOARD_ENTRY || path.endsWith('.json')) continue;
    images.set(path, data);
  }

  return { board, images, warnings };
}

export function resolveObfImageUrl(
  imageId: string | undefined,
  images: Map<string, Uint8Array>,
): string | undefined {
  if (!imageId) return undefined;
  if (imageId.startsWith('http://') || imageId.startsWith('https://') || imageId.startsWith('data:')) {
    return imageId;
  }

  const path = normalizeZipPath(imageId);
  const bytes = images.get(path) ?? images.get(`images/${path}`);
  if (!bytes) return imageId;
  return bytesToDataUrl(path, bytes);
}

export function obfToVoxaButtonsWithImages(obf: ObfBoard, images: Map<string, Uint8Array>): BoardButton[] {
  const buttons = obfToVoxaButtons(obf);
  return buttons.map((btn, index) => {
    const obfBtn = obf.buttons[index];
    const entry = obfBtn?.image_id ? obf.images?.find((image) => image.id === obfBtn.image_id) : undefined;
    let symbolUrl: string | undefined;
    if (entry) {
      const fromArchive = entry.path ? resolveObfImageUrl(entry.path, images) : undefined;
      symbolUrl =
        fromArchive && fromArchive !== entry.path ? fromArchive : (entry.data ?? entry.url ?? fromArchive);
    } else {
      symbolUrl = resolveObfImageUrl(obfBtn?.image_id, images);
    }
    return symbolUrl ? { ...btn, symbolUrl } : btn;
  });
}

/** Bytes for an image the archive should embed. */
export interface ObzLoadedImage {
  bytes: Uint8Array;
  contentType: string;
}

/**
 * Loads the bytes of a Mulberry SVG or a user-uploaded photo for embedding.
 * Return `null` when unavailable: the image entry then keeps its URL only.
 * Voxa never fetches arbitrary third-party URLs while exporting.
 */
export type ObzImageLoader = (source: ExportImageSource) => Promise<ObzLoadedImage | null>;

export interface ObzExportOptions extends ObfExportOptions {
  loadImage?: ObzImageLoader;
}

/**
 * Build an .obz archive. Embeds only Mulberry SVGs and user-supplied images
 * (inline data: URLs, or uploads via `loadImage`), each as an `images[]` entry
 * with a `path`; Mulberry entries carry their OBF `license`. Other URLs are
 * referenced, not fetched.
 */
export async function voxaBoardToObz(board: Board, options: ObzExportOptions = {}): Promise<Uint8Array> {
  const { board: obf, sources } = voxaBoardToObfWithSources(board, options);
  const files: Record<string, Uint8Array> = {};

  for (const image of obf.images ?? []) {
    const source = sources.get(image.id);
    if (!source) continue;

    let loaded: ObzLoadedImage | null = null;
    if (source.kind === 'data') {
      const bytes = decodeDataUrl(source.url);
      loaded = bytes ? { bytes, contentType: source.contentType ?? 'image/png' } : null;
    } else if ((source.kind === 'mulberry' || source.kind === 'media') && options.loadImage) {
      loaded = await options.loadImage(source);
    }
    if (!loaded) continue;

    const path = `images/${image.id}.${extensionForContentType(loaded.contentType)}`;
    files[path] = loaded.bytes;
    image.path = path;
    image.content_type = loaded.contentType;
    delete image.data;
  }

  return packObz(serializeObf(obf), files);
}

export function obzToVoxaButtons(result: ObzUnpackResult): BoardButton[] {
  return obfToVoxaButtonsWithImages(result.board, result.images);
}
