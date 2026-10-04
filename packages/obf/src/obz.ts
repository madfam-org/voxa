import { strFromU8, strToU8, zipSync } from 'fflate';
import type { Board } from '@voxa/core';
import { voxaBoardToObfWithSources, serializeObf, type ExportSoundSource, type ObfExportOptions } from './export.js';
import { extensionForContentType, type ExportImageSource } from './images.js';
import { parseObfJson, type ObfBoardSet, type ObfSetBoard } from './import.js';
import { decodeBase64 } from './media-bytes.js';
import { OBF_FORMAT, ObfImportError, type ObzManifest } from './spec.js';
import { referencedArchivePath, safeUnzip, type ZipLimits } from './zip.js';

const MANIFEST = 'manifest.json';
/** Entry name used by .obz files of earlier Voxa versions (no manifest). */
const LEGACY_BOARD_ENTRY = 'board.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, path] of Object.entries(value)) {
    if (typeof path === 'string') out[key] = path;
  }
  return out;
}

function readJsonFile(files: Map<string, Uint8Array>, path: string): string {
  const safe = referencedArchivePath(path);
  const bytes = safe ? files.get(safe) : undefined;
  if (!bytes) {
    throw new ObfImportError(`Invalid OBZ archive: ${path.slice(0, 80)} is listed but not in the package.`, 'INVALID_OBZ');
  }
  return strFromU8(bytes);
}

/**
 * Read an .obz package: `manifest.json` (`format`, `root`, `paths.boards`,
 * `paths.images`, `paths.sounds`) and every board it lists, with the package
 * files so images and sounds referenced by `path` can be resolved. Packages
 * from earlier Voxa versions (a single `board.json`, no manifest) are still
 * accepted. Unsafe archives are rejected by {@link safeUnzip}.
 */
export function unpackObz(bytes: Uint8Array, limits: Partial<ZipLimits> = {}): ObfBoardSet {
  const files = safeUnzip(bytes, limits);
  const warnings: string[] = [];

  if (files.has(MANIFEST)) {
    let manifest: unknown;
    try {
      manifest = JSON.parse(strFromU8(files.get(MANIFEST)!).replace(/^﻿/, ''));
    } catch {
      throw new ObfImportError('Invalid OBZ archive: manifest.json is not valid JSON.', 'INVALID_OBZ');
    }
    if (!isRecord(manifest) || typeof manifest.root !== 'string' || !isRecord(manifest.paths)) {
      throw new ObfImportError('Invalid OBZ archive: manifest.json needs root and paths.', 'INVALID_OBZ');
    }
    const boardPaths = stringMap(manifest.paths.boards) ?? {};
    const root = referencedArchivePath(manifest.root);
    if (!root) throw new ObfImportError('Invalid OBZ archive: manifest root is not a safe path.', 'ZIP_SLIP');

    const paths = [...new Set([root, ...Object.values(boardPaths).map((path) => referencedArchivePath(path) ?? path)])];
    const boards: ObfSetBoard[] = [];
    let rootId: string | undefined;
    for (const path of paths) {
      const parsed = parseObfJson(readJsonFile(files, path));
      warnings.push(...parsed.warnings.map((warning) => `${path}: ${warning}`));
      boards.push({ board: parsed.board, legacy: parsed.legacy, path });
      if (path === root) rootId = parsed.board.id;
    }
    return {
      boards,
      rootId: rootId ?? boards[0]!.board.id,
      files,
      imagePaths: stringMap(manifest.paths.images),
      soundPaths: stringMap(manifest.paths.sounds),
      warnings,
    };
  }

  // Earlier Voxa packages: board.json (or a single top-level .json/.obf) plus images/.
  const legacyPath =
    (files.has(LEGACY_BOARD_ENTRY) ? LEGACY_BOARD_ENTRY : undefined) ??
    [...files.keys()].find((path) => /\.(json|obf)$/i.test(path) && !path.includes('/'));
  if (!legacyPath) {
    throw new ObfImportError('Invalid OBZ archive: missing manifest.json.', 'INVALID_OBZ');
  }
  const parsed = parseObfJson(strFromU8(files.get(legacyPath)!));
  warnings.push(...parsed.warnings);
  return { boards: [{ board: parsed.board, legacy: parsed.legacy, path: legacyPath }], rootId: parsed.board.id, files, warnings };
}

/** Bytes of a picture or sound the package should embed. */
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
/** Loads the bytes of a recording uploaded to this API, or `null`. */
export type ObzSoundLoader = (source: ExportSoundSource) => Promise<ObzLoadedImage | null>;

export interface ObzExportOptions extends ObfExportOptions {
  loadImage?: ObzImageLoader;
  loadSound?: ObzSoundLoader;
}

function decodeDataUrl(url: string): { bytes: Uint8Array; contentType: string } | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(url);
  if (!match) return null;
  const bytes = decodeBase64(match[2]!);
  return bytes ? { bytes, contentType: match[1]!.toLowerCase() } : null;
}

function soundExtension(contentType: string): string {
  const subtype = contentType.split('/')[1] ?? 'bin';
  return subtype === 'mpeg' ? 'mp3' : subtype.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
}

function safeFileStem(id: string, index: number): string {
  const stem = id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  return stem || `board-${index + 1}`;
}

/**
 * Build a spec .obz package of one or more boards: `manifest.json`,
 * `boards/<id>.obf` (spec OBF 0.1, links between included boards carry
 * `load_board.path`), and embedded media under `images/` and `sounds/`.
 * Embeds only Mulberry SVGs (with their CC BY-SA licence object) and media the
 * user supplied (inline `data:` URLs, or uploads read through the loaders);
 * any other URL stays a reference and is never fetched.
 */
export async function voxaBoardsToObz(
  boards: Board[],
  rootBoardId: string,
  options: ObzExportOptions = {},
): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const boardPaths = new Map<string, string>();
  const boardNames = new Map<string, string>();
  boards.forEach((board, index) => {
    boardPaths.set(board.id as string, `boards/${safeFileStem(board.id as string, index)}.obf`);
    boardNames.set(board.id as string, board.name);
  });
  const manifest: ObzManifest = {
    format: OBF_FORMAT,
    root: boardPaths.get(rootBoardId) ?? boardPaths.get(boards[0]!.id as string)!,
    paths: { boards: {}, images: {}, sounds: {} },
  };

  let mediaCounter = 0;
  for (const board of boards) {
    const { board: obf, sources, soundSources } = voxaBoardToObfWithSources(board, {
      ...options,
      boardPaths,
      boardNames: new Map([...boardNames, ...(options.boardNames ?? [])]),
    });

    // Image and sound ids are global in manifest.paths: make them unique per package.
    const imageIdMap = new Map<string, string>();
    for (const image of obf.images) {
      mediaCounter += 1;
      const globalId = boards.length > 1 ? `${mediaCounter}-${image.id}` : image.id;
      imageIdMap.set(image.id, globalId);
      const source = sources.get(image.id);
      image.id = globalId;
      if (!source) continue;
      let loaded: ObzLoadedImage | null = null;
      if (source.kind === 'data') loaded = decodeDataUrl(source.url);
      else if ((source.kind === 'mulberry' || source.kind === 'media') && options.loadImage) loaded = await options.loadImage(source);
      if (!loaded) continue;
      const path = `images/${globalId}.${extensionForContentType(loaded.contentType)}`;
      files[path] = loaded.bytes;
      image.path = path;
      image.content_type = loaded.contentType;
      delete image.data;
      manifest.paths.images![globalId] = path;
    }

    const soundIdMap = new Map<string, string>();
    for (const sound of obf.sounds) {
      mediaCounter += 1;
      const globalId = boards.length > 1 ? `${mediaCounter}-${sound.id}` : sound.id;
      soundIdMap.set(sound.id, globalId);
      const source = soundSources.get(sound.id);
      sound.id = globalId;
      if (!source) continue;
      let loaded: ObzLoadedImage | null = null;
      if (source.kind === 'data') loaded = decodeDataUrl(source.url);
      else if (source.kind === 'media' && options.loadSound) loaded = await options.loadSound(source);
      if (!loaded) continue;
      const path = `sounds/${globalId}.${soundExtension(loaded.contentType)}`;
      files[path] = loaded.bytes;
      sound.path = path;
      sound.content_type = loaded.contentType;
      delete sound.data;
      manifest.paths.sounds![globalId] = path;
    }

    for (const button of obf.buttons) {
      if (button.image_id) button.image_id = imageIdMap.get(button.image_id) ?? button.image_id;
      if (button.sound_id) button.sound_id = soundIdMap.get(button.sound_id) ?? button.sound_id;
    }

    const path = boardPaths.get(board.id as string)!;
    manifest.paths.boards[obf.id] = path;
    files[path] = strToU8(serializeObf(obf));
  }

  files[MANIFEST] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(files);
}

/** .obz package of a single board. */
export async function voxaBoardToObz(board: Board, options: ObzExportOptions = {}): Promise<Uint8Array> {
  return voxaBoardsToObz([board], board.id as string, options);
}
