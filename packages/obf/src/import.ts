import {
  createBoardId,
  createButtonId,
  createProfileId,
  type Board,
  type BoardButton,
  type BoardDisplayPreferences,
  type GridPosition,
  type MediaAsset,
  type PartOfSpeechTag,
  type RecordedSpeech,
  type SpeechForm,
  type SymbolRef,
} from '@voxa/core';
import { isRemovedSymbolUrl, MULBERRY_ASSET_BASE, mulberryPathFromUrl } from '@voxa/symbols';
import { resolvePartOfSpeech } from '@voxa/vocabulary';
import { decodeBase64, sniffMediaType } from './media-bytes.js';
import {
  normalizeObfLocale,
  obfColorToHex,
  ObfImportError,
  type ObfBoard,
  type ObfButton,
  type ObfImage,
  type ObfLoadBoard,
  type ObfSound,
} from './spec.js';
import { referencedArchivePath } from './zip.js';

/** Bounds on what one import may contain. */
export const OBF_IMPORT_LIMITS = {
  maxBoards: 200,
  maxRows: 50,
  maxColumns: 50,
  maxButtonsPerBoard: 2500,
  maxImagesPerBoard: 2500,
  maxDataUrlChars: 8 * 1024 * 1024,
} as const;

/** One board of an import set. `legacy` marks Voxa's pre-spec dialect. */
export interface ObfSetBoard {
  board: ObfBoard;
  /** Path inside the .obz package. */
  path?: string;
  legacy: boolean;
}

/** One .obf file, or every board of an .obz package with its files. */
export interface ObfBoardSet {
  boards: ObfSetBoard[];
  rootId: string;
  /** Files of the .obz package (path → bytes); empty for a single .obf. */
  files: Map<string, Uint8Array>;
  /** `manifest.json` `paths.images` / `paths.sounds` (id → path). */
  imagePaths?: Record<string, string>;
  soundPaths?: Record<string, string>;
  warnings: string[];
}

export interface ParsedObf {
  board: ObfBoard;
  legacy: boolean;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function positiveInt(value: unknown, max: number, field: string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
    throw new ObfImportError(`Invalid OBF document: ${field} must be a positive integer.`, 'INVALID_OBF');
  }
  if (n > max) {
    throw new ObfImportError(`Invalid OBF document: ${field} is larger than ${max}.`, 'INVALID_OBF');
  }
  return n;
}

function looksLikeImageReference(value: string): boolean {
  return /^(https?:\/\/|data:|\/|images\/)/i.test(value) || /\.(png|jpe?g|gif|webp|svg)$/i.test(value);
}

/**
 * Parse one OBF board. Accepts spec OBF 0.1 (`format: 'open-board-0.1'`,
 * 2-D `grid.order`, `images[]`, `load_board{}`) and the dialect earlier Voxa
 * versions exported (`format: 'open-board-format'`, `grid.order:
 * 'row-major'`, image URLs in `image_id`, `load_board_id`), which is
 * normalised to the spec shape. Throws {@link ObfImportError} (HTTP 400) for
 * anything that is not a board.
 */
export function parseObfJson(raw: string | unknown): ParsedObf {
  let json: unknown = raw;
  if (typeof raw === 'string') {
    try {
      json = JSON.parse(raw.replace(/^﻿/, ''));
    } catch {
      throw new ObfImportError('Invalid OBF document: not valid JSON.', 'INVALID_OBF');
    }
  }
  if (!isRecord(json)) throw new ObfImportError('Invalid OBF document: expected a JSON object.', 'INVALID_OBF');

  const warnings: string[] = [];
  const grid = json.grid;
  const rawButtons = json.buttons;
  if (!isRecord(grid) || !Array.isArray(rawButtons)) {
    throw new ObfImportError('Invalid OBF document: requires grid and buttons array.', 'INVALID_OBF');
  }
  if (rawButtons.length > OBF_IMPORT_LIMITS.maxButtonsPerBoard) {
    throw new ObfImportError('Invalid OBF document: too many buttons.', 'INVALID_OBF');
  }
  const rows = positiveInt(grid.rows, OBF_IMPORT_LIMITS.maxRows, 'grid.rows');
  const columns = positiveInt(grid.columns, OBF_IMPORT_LIMITS.maxColumns, 'grid.columns');

  const format = str(json.format);
  const legacy = format === 'open-board-format' || typeof grid.order === 'string';
  if (!legacy && format && !format.startsWith('open-board-')) {
    warnings.push(`Unknown OBF format "${format.slice(0, 40)}"; imported as open-board-0.1.`);
  } else if (!format) {
    warnings.push('Missing OBF format marker; imported as open-board-0.1.');
  }

  const images: ObfImage[] = Array.isArray(json.images)
    ? json.images.filter(isRecord).slice(0, OBF_IMPORT_LIMITS.maxImagesPerBoard).flatMap((image) => {
        const id = str(image.id);
        return id ? [{ ...(image as object), id } as ObfImage] : [];
      })
    : [];
  const sounds: ObfSound[] = Array.isArray(json.sounds)
    ? json.sounds.filter(isRecord).slice(0, OBF_IMPORT_LIMITS.maxImagesPerBoard).flatMap((sound) => {
        const id = str(sound.id);
        return id ? [{ ...(sound as object), id } as ObfSound] : [];
      })
    : [];
  const imageIds = new Set(images.map((image) => image.id));

  const seen = new Set<string>();
  const buttons: ObfButton[] = [];
  rawButtons.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    let id = str(entry.id) ?? `button-${index + 1}`;
    if (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    const button = { ...(entry as object), id } as ObfButton;

    if (legacy) {
      const imageRef = str(entry.image_id);
      if (imageRef && !imageIds.has(imageRef) && looksLikeImageReference(imageRef)) {
        const isUrl = /^(https?:|data:|\/)/i.test(imageRef);
        images.push({ id: imageRef, ...(isUrl ? { url: imageRef } : { path: imageRef }) });
        imageIds.add(imageRef);
      }
      const loadBoardId = str(entry.load_board_id);
      if (loadBoardId && !isRecord(entry.load_board)) button.load_board = { id: loadBoardId };
      delete (button as unknown as Record<string, unknown>).load_board_id;
    }
    buttons.push(button);
  });

  let order: Array<Array<string | null>>;
  if (Array.isArray(grid.order) && grid.order.every((row) => Array.isArray(row))) {
    order = Array.from({ length: rows }, (_, r) => {
      const row = (grid.order as unknown[][])[r] ?? [];
      return Array.from({ length: columns }, (_, c) => str(row[c]) ?? null);
    });
    if ((grid.order as unknown[]).length !== rows) {
      warnings.push(`grid.order has ${(grid.order as unknown[]).length} rows; the grid declares ${rows}.`);
    }
  } else {
    // Legacy Voxa dialect (or no order at all): buttons fill the grid in array order.
    const columnMajor = grid.order === 'column-major';
    order = Array.from({ length: rows }, () => Array.from({ length: columns }, () => null as string | null));
    buttons.slice(0, rows * columns).forEach((button, index) => {
      const row = columnMajor ? index % rows : Math.floor(index / columns);
      const column = columnMajor ? Math.floor(index / rows) : index % columns;
      order[row]![column] = button.id;
    });
    if (!legacy) warnings.push('grid.order is missing; buttons were placed in file order.');
  }

  const board: ObfBoard = {
    ...(json as object),
    format: 'open-board-0.1',
    id: str(json.id) ?? 'board',
    grid: { rows, columns, order },
    buttons,
    images,
    sounds,
  } as ObfBoard;
  if (legacy) {
    delete (board as unknown as Record<string, unknown>).formatVersion;
  }
  const locale = normalizeObfLocale(json.locale);
  if (locale) board.locale = locale;
  else delete board.locale;

  return { board, legacy, warnings };
}

/** A single .obf file as an import set. */
export function obfSetFromJson(raw: string): ObfBoardSet {
  const { board, legacy, warnings } = parseObfJson(raw);
  return { boards: [{ board, legacy }], rootId: board.id, files: new Map(), warnings };
}

// ---------------------------------------------------------------------------
// Conversion to Voxa boards
// ---------------------------------------------------------------------------

/** Media Voxa must store for an imported board (decoded from `data:` or the package). */
export interface ImportedMedia {
  kind: 'image' | 'sound';
  /** The NEW Voxa board id the media belongs to. */
  boardId: string;
  bytes: Uint8Array;
  contentType: string;
}

export interface ObfImportOptions {
  /** New Voxa id for the OBF board `obfId` (imports never reuse or overwrite an existing board). */
  newBoardId: (obfId: string, index: number) => string;
  /**
   * Stores an embedded image or sound and returns the URL the board keeps.
   * Return `undefined` (or throw) to drop it; it is counted as skipped.
   * Default: keep the bytes as a `data:` URL.
   */
  storeMedia?: (media: ImportedMedia) => Promise<string | undefined>;
  /**
   * Remote (http/https) image and sound URLs. `mulberry-only` (default) keeps
   * only pictures of Voxa's vendored Mulberry set (rewritten to the local
   * path) and drops every other remote URL, which is counted as skipped:
   * nothing is fetched server-side and no third-party URL is stored.
   */
  remoteMedia?: 'mulberry-only' | 'keep';
  /**
   * A `load_board` whose target is not in the import set: return true to keep
   * the link (the id names a board the importer can open). Default: drop.
   */
  keepExternalLink?: (boardId: string) => boolean;
  /** Locale when the file has none. Default `es-MX`. */
  fallbackLocale?: string;
  profileId?: string;
}

export interface ObfImportSkipped {
  /** Pictures not imported (remote URLs, unsupported or oversized files). */
  images: number;
  /** Recorded sounds or videos not imported. */
  sounds: number;
  /** Links to boards that are not part of the import. */
  links: number;
  /** Buttons that are not placed in the grid. */
  buttons: number;
}

export interface ObfImportResult {
  boards: Board[];
  rootBoardId: string;
  warnings: string[];
  skipped: ObfImportSkipped;
}

type KeyboardRole = NonNullable<BoardButton['keyboardRole']>;
const KEYBOARD_ROLES = new Set<KeyboardRole>(['char', 'space', 'backspace', 'clear']);

const PART_OF_SPEECH = new Set<PartOfSpeechTag>([
  'adjective',
  'verb',
  'pronoun',
  'noun',
  'preposition',
  'social',
  'conjunction',
]);

function bytesToDataUrl(contentType: string, bytes: Uint8Array): string {
  const base64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(bytes).toString('base64')
      : btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
  return `data:${contentType};base64,${base64}`;
}

function decodeDataUrl(url: string, kind: 'image' | 'sound'): Uint8Array | undefined {
  if (url.length > OBF_IMPORT_LIMITS.maxDataUrlChars) return undefined;
  const prefix = kind === 'image' ? 'image/' : 'audio/';
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/is.exec(url);
  if (!match || !match[1]!.toLowerCase().startsWith(prefix)) return undefined;
  return decodeBase64(match[2]!);
}

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function validSymbolRef(value: unknown): SymbolRef | undefined {
  if (!isRecord(value) || value.provider !== 'mulberry' || typeof value.slug !== 'string') return undefined;
  return {
    provider: 'mulberry',
    slug: value.slug,
    ...(typeof value.file === 'string' ? { file: value.file } : {}),
  };
}

function validSpeechForms(value: unknown): SpeechForm[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const forms = value.filter(
    (form): form is SpeechForm =>
      isRecord(form) &&
      typeof form.id === 'string' &&
      typeof form.label === 'string' &&
      typeof form.speechText === 'string',
  );
  return forms.length === value.length ? forms.map(({ id, label, speechText }) => ({ id, label, speechText })) : undefined;
}

function validPosition(value: unknown): GridPosition | undefined {
  if (!isRecord(value)) return undefined;
  const { row, column } = value;
  return Number.isInteger(row) && Number.isInteger(column) && (row as number) >= 0 && (column as number) >= 0
    ? { row: row as number, column: column as number }
    : undefined;
}

class BoardConverter {
  private readonly imageUrls = new Map<string, Promise<string | undefined>>();
  private readonly soundUrls = new Map<string, Promise<string | undefined>>();

  constructor(
    private readonly set: ObfBoardSet,
    private readonly entry: ObfSetBoard,
    private readonly newId: string,
    private readonly options: ObfImportOptions,
    private readonly skipped: ObfImportSkipped,
    private readonly resolveLink: (link: ObfLoadBoard) => string | undefined,
  ) {}

  private get isVoxa(): boolean {
    return this.entry.board.ext_voxa_schema !== undefined;
  }

  private archiveBytes(path: string | undefined): Uint8Array | undefined {
    if (!path) return undefined;
    const safe = referencedArchivePath(path);
    return safe ? this.set.files.get(safe) : undefined;
  }

  private async store(kind: 'image' | 'sound', bytes: Uint8Array | undefined): Promise<string | undefined> {
    if (!bytes) return undefined;
    const contentType = sniffMediaType(bytes, kind);
    if (!contentType) return undefined;
    if (!this.options.storeMedia) return bytesToDataUrl(contentType, bytes);
    try {
      return await this.options.storeMedia({ kind, boardId: this.newId, bytes, contentType });
    } catch {
      return undefined;
    }
  }

  private async resolveImageEntry(image: ObfImage): Promise<string | undefined> {
    const url = typeof image.url === 'string' ? image.url : undefined;
    if (url) {
      if (isRemovedSymbolUrl(url)) return undefined;
      const mulberry = mulberryPathFromUrl(url);
      if (mulberry) return `${MULBERRY_ASSET_BASE}/${mulberry}`;
    }
    const embedded =
      (typeof image.data === 'string' ? decodeDataUrl(image.data, 'image') : undefined) ??
      this.archiveBytes(typeof image.path === 'string' ? image.path : this.set.imagePaths?.[image.id]) ??
      (url?.startsWith('data:') ? decodeDataUrl(url, 'image') : undefined);
    if (embedded) return this.store('image', embedded);
    if (url && isRemoteUrl(url) && this.options.remoteMedia === 'keep') return url;
    return undefined;
  }

  private imageUrl(imageId: string): Promise<string | undefined> {
    let pending = this.imageUrls.get(imageId);
    if (!pending) {
      const image = this.entry.board.images.find((candidate) => candidate.id === imageId);
      pending = image ? this.resolveImageEntry(image) : Promise.resolve(undefined);
      this.imageUrls.set(imageId, pending);
    }
    return pending;
  }

  private async resolveSoundEntry(sound: ObfSound): Promise<string | undefined> {
    const url = typeof sound.url === 'string' ? sound.url : undefined;
    const embedded =
      (typeof sound.data === 'string' ? decodeDataUrl(sound.data, 'sound') : undefined) ??
      this.archiveBytes(typeof sound.path === 'string' ? sound.path : this.set.soundPaths?.[sound.id]) ??
      (url?.startsWith('data:') ? decodeDataUrl(url, 'sound') : undefined);
    if (embedded) return this.store('sound', embedded);
    if (url && isRemoteUrl(url) && this.options.remoteMedia === 'keep') return url;
    return undefined;
  }

  private soundUrl(soundId: string): Promise<string | undefined> {
    let pending = this.soundUrls.get(soundId);
    if (!pending) {
      const sound = this.entry.board.sounds.find((candidate) => candidate.id === soundId);
      pending = sound ? this.resolveSoundEntry(sound) : Promise.resolve(undefined);
      this.soundUrls.set(soundId, pending);
    }
    return pending;
  }

  private async recordedSpeech(btn: ObfButton): Promise<RecordedSpeech | undefined> {
    if (!btn.sound_id) return undefined;
    const sound = this.entry.board.sounds.find((candidate) => candidate.id === btn.sound_id);
    const url = await this.soundUrl(btn.sound_id);
    if (!url) {
      this.skipped.sounds += 1;
      return undefined;
    }
    const recordedBy = typeof sound?.ext_voxa_recorded_by === 'string' ? sound.ext_voxa_recorded_by : 'import';
    const durationMs =
      typeof sound?.ext_voxa_duration_ms === 'number'
        ? sound.ext_voxa_duration_ms
        : typeof sound?.duration === 'number'
          ? Math.round(sound.duration * 1000)
          : undefined;
    return { url, recordedBy, ...(durationMs !== undefined ? { durationMs } : {}) };
  }

  private video(btn: ObfButton): MediaAsset | undefined {
    const value = btn.ext_voxa_video;
    if (!isRecord(value) || typeof value.url !== 'string' || typeof value.mimeType !== 'string') return undefined;
    const keep = this.options.remoteMedia === 'keep' || (!isRemoteUrl(value.url) && !value.url.startsWith('//'));
    if (!keep || value.url.startsWith('data:')) {
      this.skipped.sounds += 1;
      return undefined;
    }
    return {
      url: value.url,
      mimeType: value.mimeType,
      ...(typeof value.thumbnailUrl === 'string' ? { thumbnailUrl: value.thumbnailUrl } : {}),
    };
  }

  async button(btn: ObfButton, id: string, position: GridPosition, boardLocale: string): Promise<BoardButton> {
    const label = typeof btn.label === 'string' ? btn.label : typeof btn.vocalization === 'string' ? btn.vocalization : '';
    const vocalization = typeof btn.vocalization === 'string' ? btn.vocalization : label;
    const locale = typeof btn.ext_voxa_locale === 'string' ? btn.ext_voxa_locale : boardLocale;
    const isGlp = this.isVoxa && btn.ext_voxa_kind === 'glp';

    let symbolUrl: string | undefined;
    if (btn.image_id) {
      symbolUrl = await this.imageUrl(btn.image_id);
      if (!symbolUrl) this.skipped.images += 1;
    }
    const symbolRef = this.isVoxa ? validSymbolRef(btn.ext_voxa_symbol_ref) : undefined;
    if (symbolRef && btn.ext_voxa_symbol_from_ref === true) symbolUrl = undefined;
    const audio = await this.recordedSpeech(btn);

    let partOfSpeech: PartOfSpeechTag | undefined;
    if (this.isVoxa) {
      const tag = btn.ext_voxa_part_of_speech;
      partOfSpeech = typeof tag === 'string' && PART_OF_SPEECH.has(tag as PartOfSpeechTag) ? (tag as PartOfSpeechTag) : undefined;
    } else {
      partOfSpeech = resolvePartOfSpeech(
        isGlp ? { kind: 'glp', phrase: vocalization } : { kind: 'analytic', label },
        obfColorToHex(btn.border_color),
      );
    }

    const common = {
      id: createButtonId(id),
      ...(symbolUrl ? { symbolUrl } : {}),
      ...(symbolRef ? { symbolRef } : {}),
      ...(audio ? { audio } : {}),
      locale,
      position,
      locked: this.isVoxa ? btn.ext_voxa_locked === true : false,
      ...(partOfSpeech ? { partOfSpeech } : {}),
      ...(typeof btn.hidden === 'boolean' ? { hidden: btn.hidden } : {}),
      ...(this.isVoxa && KEYBOARD_ROLES.has(btn.ext_voxa_keyboard_role as KeyboardRole)
        ? { keyboardRole: btn.ext_voxa_keyboard_role as KeyboardRole }
        : {}),
    };

    let navigateToBoardId: string | undefined;
    if (btn.load_board) {
      navigateToBoardId = this.resolveLink(btn.load_board);
      if (!navigateToBoardId) this.skipped.links += 1;
    }
    const link = navigateToBoardId ? { navigateToBoardId: createBoardId(navigateToBoardId) } : {};

    if (isGlp) {
      const video = this.video(btn);
      return {
        kind: 'glp',
        phrase: vocalization,
        ...common,
        ...(video ? { video } : {}),
        ...(typeof btn.ext_voxa_intonation_notes === 'string' ? { intonationNotes: btn.ext_voxa_intonation_notes } : {}),
        ...link,
      } as BoardButton;
    }

    const speechForms = this.isVoxa ? validSpeechForms(btn.ext_voxa_speech_forms) : undefined;
    return {
      kind: 'analytic',
      label,
      speechText: vocalization,
      ...common,
      ...(speechForms ? { speechForms } : {}),
      ...(this.isVoxa && typeof btn.ext_voxa_active_speech_form_id === 'string'
        ? { activeSpeechFormId: btn.ext_voxa_active_speech_form_id }
        : {}),
      ...link,
    } as BoardButton;
  }

  async convert(): Promise<Board> {
    const obf = this.entry.board;
    const locale = normalizeObfLocale(obf.locale) ?? this.options.fallbackLocale ?? 'es-MX';
    const byId = new Map(obf.buttons.map((btn) => [btn.id, btn]));
    const placed = new Set<string>();
    const usedIds = new Set<string>();
    const occupied = new Set<string>();
    const buttons: BoardButton[] = [];

    for (let row = 0; row < obf.grid.rows; row += 1) {
      for (let column = 0; column < obf.grid.columns; column += 1) {
        const ref = obf.grid.order[row]?.[column];
        const btn = ref ? byId.get(ref) : undefined;
        if (!btn) continue;
        // The spec allows one button in several cells; Voxa ids are unique per board.
        const id = usedIds.has(btn.id) ? `${btn.id}-r${row}c${column}` : btn.id;
        usedIds.add(id);
        placed.add(btn.id);
        occupied.add(`${row}:${column}`);
        buttons.push(await this.button(btn, id, { row, column }, locale));
      }
    }

    for (const btn of obf.buttons) {
      if (placed.has(btn.id)) continue;
      const position = this.isVoxa ? validPosition(btn.ext_voxa_position) : undefined;
      if (!position || usedIds.has(btn.id)) {
        this.skipped.buttons += 1;
        continue;
      }
      usedIds.add(btn.id);
      buttons.push(await this.button(btn, btn.id, position, locale));
    }

    const board: Board = {
      id: createBoardId(this.newId),
      name: (typeof obf.name === 'string' && obf.name.trim() ? obf.name.trim() : obf.id).slice(0, 200),
      profileId: createProfileId(this.options.profileId ?? 'default'),
      grid: { rows: obf.grid.rows, columns: obf.grid.columns, buttons },
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    if (this.isVoxa) {
      const layout = obf.ext_voxa_layout;
      if (layout === 'grid' || layout === 'literacy-keyboard' || layout === 'visual-schedule') board.layout = layout;
      if (isRecord(obf.ext_voxa_display)) board.display = obf.ext_voxa_display as BoardDisplayPreferences;
    }
    return board;
  }
}

/**
 * Convert an import set into NEW Voxa boards: every OBF board gets a new id
 * from `options.newBoardId`, `load_board` links between boards of the set are
 * remapped to those ids, and embedded media goes through `options.storeMedia`.
 * Nothing here reads or writes an existing board.
 */
export async function obfSetToVoxaBoards(set: ObfBoardSet, options: ObfImportOptions): Promise<ObfImportResult> {
  if (set.boards.length === 0) throw new ObfImportError('The file contains no boards.', 'INVALID_OBF');
  if (set.boards.length > OBF_IMPORT_LIMITS.maxBoards) {
    throw new ObfImportError(`The file contains more than ${OBF_IMPORT_LIMITS.maxBoards} boards.`, 'INVALID_OBF');
  }

  const idMap = new Map<string, string>();
  const pathMap = new Map<string, string>();
  const newIds = set.boards.map((entry, index) => {
    const newId = options.newBoardId(entry.board.id, index);
    if (!idMap.has(entry.board.id)) idMap.set(entry.board.id, newId);
    if (entry.path) pathMap.set(entry.path, newId);
    return newId;
  });

  const resolveLink = (link: ObfLoadBoard): string | undefined => {
    const byPath = link.path ? pathMap.get(referencedArchivePath(link.path) ?? '') : undefined;
    if (byPath) return byPath;
    const id = str(link.id);
    if (id && idMap.has(id)) return idMap.get(id);
    if (id && options.keepExternalLink?.(id)) return id;
    return undefined;
  };

  const skipped: ObfImportSkipped = { images: 0, sounds: 0, links: 0, buttons: 0 };
  const boards: Board[] = [];
  for (const [index, entry] of set.boards.entries()) {
    boards.push(await new BoardConverter(set, entry, newIds[index]!, options, skipped, resolveLink).convert());
  }

  const warnings = [...set.warnings];
  if (skipped.buttons > 0) warnings.push(`${skipped.buttons} buttons are not placed in the grid and were not imported.`);
  if (skipped.links > 0) warnings.push(`${skipped.links} links point at boards that are not part of this file and were removed.`);

  const rootBoardId = idMap.get(set.rootId) ?? boards[0]!.id;
  return { boards, rootBoardId: rootBoardId as string, warnings, skipped };
}
