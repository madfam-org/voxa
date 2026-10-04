import { boardContentLocale, type Board, type BoardButton, type RecordedSpeech } from '@voxa/core';
import { isRemovedSymbolRef } from '@voxa/symbols';
import { fitzgeraldColor, resolvePartOfSpeech } from '@voxa/vocabulary';
import { buttonImageSource, obfImageFor, type ExportImageSource } from './images.js';
import {
  OBF_FORMAT,
  toObfColor,
  VOXA_EXT_SCHEMA,
  type ObfBoard,
  type ObfButton,
  type ObfImage,
  type ObfSound,
} from './spec.js';

export interface ObfExportOptions {
  /**
   * Origin that serves the vendored Mulberry SVGs (e.g. `https://voxa.madfam.io`).
   * Without it, Mulberry image URLs stay relative (`/symbols/mulberry/…`).
   */
  assetBaseUrl?: string;
  /** Names of linked boards, written as `load_board.name`. */
  boardNames?: ReadonlyMap<string, string>;
  /** Paths of linked boards inside an .obz package, written as `load_board.path`. */
  boardPaths?: ReadonlyMap<string, string>;
}

/** Where a recorded sound comes from, for export. */
export interface ExportSoundSource {
  kind: 'data' | 'media' | 'external';
  url: string;
  contentType?: string;
  mediaId?: string;
}

/** OBF board plus the export source of each image and sound entry (by entry id). */
export interface ObfExport {
  board: ObfBoard;
  sources: Map<string, ExportImageSource>;
  soundSources: Map<string, ExportSoundSource>;
}

const DATA_AUDIO = /^data:(audio\/[A-Za-z0-9.+-]+);base64,/i;
const MEDIA_PATH = /(?:^|\/)v1\/media\/([A-Za-z0-9_-]{1,128})$/;

export function classifySoundUrl(url: string | undefined): ExportSoundSource | undefined {
  if (!url) return undefined;
  const data = DATA_AUDIO.exec(url);
  if (data) return { kind: 'data', url, contentType: data[1]!.toLowerCase() };
  let pathname = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      pathname = new URL(url).pathname;
    } catch {
      return undefined;
    }
  }
  const mediaId = MEDIA_PATH.exec(pathname)?.[1];
  if (mediaId) return { kind: 'media', url, mediaId };
  if (/^https?:\/\//i.test(url)) return { kind: 'external', url };
  return undefined;
}

function sortedButtons(board: Board): BoardButton[] {
  return [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );
}

function soundEntry(id: string, audio: RecordedSpeech, source: ExportSoundSource): ObfSound {
  const entry: ObfSound = { id };
  if (source.kind === 'data') {
    entry.data = source.url;
    if (source.contentType) entry.content_type = source.contentType;
  } else {
    entry.url = source.url;
  }
  if (audio.durationMs !== undefined) {
    entry.duration = Math.max(0, Math.round(audio.durationMs / 1000));
    entry.ext_voxa_duration_ms = audio.durationMs;
  }
  entry.ext_voxa_recorded_by = audio.recordedBy;
  return entry;
}

/**
 * Build a spec OBF 0.1 board (`format: 'open-board-0.1'`).
 *
 * - `grid.order` is a 2-D array of button ids (`null` for empty cells); a
 *   button whose cell is outside the grid or already taken keeps its position
 *   in `ext_voxa_position`.
 * - Pictures become `images[]` entries referenced by `image_id`: Mulberry
 *   symbols carry their CC BY-SA licence object; pictures of the removed
 *   non-commercial library are never emitted (label-only).
 * - Recorded speech becomes `sounds[]` entries referenced by `sound_id`.
 * - Links become `load_board: { id, name?, path? }`; colours are `rgb()`.
 * - Everything else Voxa needs to restore the board exactly (motor-plan
 *   locks, part of speech, GLP data, word forms, symbol references,
 *   keyboard roles, layout, display) travels as `ext_voxa_*`.
 */
export function voxaBoardToObfWithSources(board: Board, options: ObfExportOptions = {}): ObfExport {
  const { rows, columns } = board.grid;
  const locale = boardContentLocale(board) ?? 'es-MX';
  const images: ObfImage[] = [];
  const sounds: ObfSound[] = [];
  const sources = new Map<string, ExportImageSource>();
  const soundSources = new Map<string, ExportSoundSource>();
  const imageIdByKey = new Map<string, string>();
  const order: Array<Array<string | null>> = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => null),
  );

  const imageIdFor = (btn: BoardButton): string | undefined => {
    const source = buttonImageSource(btn);
    if (!source) return undefined;
    const key = source.kind === 'mulberry' ? `mulberry:${source.mulberryPath}` : source.url;
    const existing = imageIdByKey.get(key);
    if (existing) return existing;
    const id = `image-${images.length + 1}`;
    imageIdByKey.set(key, id);
    sources.set(id, source);
    images.push(obfImageFor(id, source, options));
    return id;
  };

  const buttons = sortedButtons(board).map((btn): ObfButton => {
    const id = btn.id as string;
    const label = btn.kind === 'analytic' ? btn.label : btn.phrase;
    const out: ObfButton = {
      id,
      label,
      vocalization: btn.kind === 'analytic' ? btn.speechText : btn.phrase,
    };

    const imageId = imageIdFor(btn);
    if (imageId) out.image_id = imageId;

    if (btn.audio) {
      const source = classifySoundUrl(btn.audio.url);
      if (source) {
        const soundId = `sound-${sounds.length + 1}`;
        sounds.push(soundEntry(soundId, btn.audio, source));
        soundSources.set(soundId, source);
        out.sound_id = soundId;
      }
    }

    out.border_color = toObfColor(fitzgeraldColor(resolvePartOfSpeech(btn)));
    if (btn.hidden !== undefined) out.hidden = btn.hidden;

    if (btn.navigateToBoardId) {
      const target = btn.navigateToBoardId as string;
      const name = options.boardNames?.get(target);
      const path = options.boardPaths?.get(target);
      out.load_board = { id: target, ...(name ? { name } : {}), ...(path ? { path } : {}) };
    }

    // Voxa extensions: exactly what the spec has no field for.
    if (btn.kind === 'glp') {
      out.ext_voxa_kind = 'glp';
      if (btn.video) out.ext_voxa_video = btn.video;
      if (btn.intonationNotes !== undefined) out.ext_voxa_intonation_notes = btn.intonationNotes;
    } else {
      if (btn.speechForms) out.ext_voxa_speech_forms = btn.speechForms;
      if (btn.activeSpeechFormId !== undefined) out.ext_voxa_active_speech_form_id = btn.activeSpeechFormId;
    }
    if (btn.locale !== locale) out.ext_voxa_locale = btn.locale;
    out.ext_voxa_locked = btn.locked;
    if (btn.partOfSpeech !== undefined) out.ext_voxa_part_of_speech = btn.partOfSpeech;
    if (btn.keyboardRole !== undefined) out.ext_voxa_keyboard_role = btn.keyboardRole;
    if (btn.symbolRef && !isRemovedSymbolRef(btn.symbolRef)) {
      out.ext_voxa_symbol_ref = btn.symbolRef;
      if (btn.symbolUrl === undefined) out.ext_voxa_symbol_from_ref = true;
    }
    if (btn.audio && !out.sound_id) out.ext_voxa_audio = btn.audio;

    const { row, column } = btn.position;
    const inGrid = row >= 0 && row < rows && column >= 0 && column < columns;
    if (inGrid && order[row]![column] === null) {
      order[row]![column] = id;
    } else {
      out.ext_voxa_position = { row, column };
    }
    return out;
  });

  const obf: ObfBoard = {
    format: OBF_FORMAT,
    id: board.id as string,
    locale,
    name: board.name,
    grid: { rows, columns, order },
    buttons,
    images,
    sounds,
    ext_voxa_schema: VOXA_EXT_SCHEMA,
  };
  if (board.layout !== undefined) obf.ext_voxa_layout = board.layout;
  if (board.display !== undefined) obf.ext_voxa_display = board.display;

  return { board: obf, sources, soundSources };
}

export function voxaBoardToObf(board: Board, options: ObfExportOptions = {}): ObfBoard {
  return voxaBoardToObfWithSources(board, options).board;
}

export function serializeObf(board: ObfBoard): string {
  return JSON.stringify(board, null, 2);
}
