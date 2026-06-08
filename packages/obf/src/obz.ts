import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Board, BoardButton } from '@voxa/core';
import { obfToVoxaButtons, parseObfJson, serializeObf, voxaBoardToObf, type ObfBoard } from './index.js';

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

export async function fetchSymbolBytes(url: string): Promise<Uint8Array | null> {
  if (url.startsWith('data:')) return decodeDataUrl(url);
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
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
    const symbolUrl = resolveObfImageUrl(obfBtn?.image_id, images);
    return symbolUrl ? { ...btn, symbolUrl } : btn;
  });
}

export async function voxaBoardToObz(board: Board): Promise<Uint8Array> {
  const obf = voxaBoardToObf(board);
  const sorted = [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );
  const images: Record<string, Uint8Array> = {};

  for (let index = 0; index < obf.buttons.length; index += 1) {
    const obfBtn = obf.buttons[index];
    const voxaBtn = sorted[index];
    if (!obfBtn || !voxaBtn?.symbolUrl) continue;

    const bytes = await fetchSymbolBytes(voxaBtn.symbolUrl);
    if (!bytes) continue;

    const ext = voxaBtn.symbolUrl.includes('image/jpeg') ? 'jpg' : 'png';
    const path = `images/${obfBtn.id}.${ext}`;
    images[path] = bytes;
    obfBtn.image_id = path;
  }

  return packObz(serializeObf(obf), images);
}

export function obzToVoxaButtons(result: ObzUnpackResult): BoardButton[] {
  return obfToVoxaButtonsWithImages(result.board, result.images);
}
