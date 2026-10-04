/**
 * Open Board Format 0.1 — types, constants and small helpers.
 *
 * Spec: https://www.openboardformat.org/docs (format `open-board-0.1`).
 * Field names follow the spec and the reference validator of the
 * `open-aac/obf` project. Anything Voxa-specific travels as an `ext_voxa_*`
 * property, the spec's extension mechanism; readers that do not know Voxa
 * ignore it.
 */

export const OBF_FORMAT = 'open-board-0.1';

/** Marker on boards written by Voxa; its value is the version of the `ext_voxa_*` mapping. */
export const VOXA_EXT_SCHEMA = 1;

/** Extension properties (`ext_<app>_<name>`). */
export type ObfExtensions = { [key: `ext_${string}`]: unknown };

/** OBF licence object (boards, images and sounds). */
export interface ObfLicense {
  type: string;
  copyright_notice_url?: string;
  source_url?: string;
  author_name?: string;
  author_url?: string;
  author_email?: string;
}

/** `images[]` entry, referenced by `button.image_id`. */
export interface ObfImage extends ObfExtensions {
  id: string;
  url?: string;
  data?: string;
  data_url?: string;
  /** Path inside an .obz package. */
  path?: string;
  content_type?: string;
  width?: number;
  height?: number;
  license?: ObfLicense;
  symbol?: { set?: string; filename?: string };
}

/** `sounds[]` entry, referenced by `button.sound_id`. */
export interface ObfSound extends ObfExtensions {
  id: string;
  url?: string;
  data?: string;
  data_url?: string;
  path?: string;
  content_type?: string;
  /** Seconds. */
  duration?: number;
  license?: ObfLicense;
}

/** `button.load_board`: the board a button opens. */
export interface ObfLoadBoard {
  id?: string;
  name?: string;
  url?: string;
  data_url?: string;
  /** Path of the target board inside an .obz package. */
  path?: string;
}

export interface ObfButton extends ObfExtensions {
  id: string;
  label?: string;
  vocalization?: string;
  image_id?: string;
  sound_id?: string;
  background_color?: string;
  border_color?: string;
  hidden?: boolean;
  action?: string;
  actions?: string[];
  load_board?: ObfLoadBoard;
}

export interface ObfGrid {
  rows: number;
  columns: number;
  /** `rows` arrays of `columns` button ids; `null` marks an empty cell. */
  order: Array<Array<string | null>>;
}

export interface ObfBoard extends ObfExtensions {
  format: string;
  id: string;
  locale?: string;
  url?: string;
  data_url?: string;
  name?: string;
  description_html?: string;
  grid: ObfGrid;
  buttons: ObfButton[];
  images: ObfImage[];
  sounds: ObfSound[];
  license?: ObfLicense;
}

/** `manifest.json` of an .obz package. */
export interface ObzManifest extends ObfExtensions {
  format: string;
  root: string;
  paths: {
    boards: Record<string, string>;
    images?: Record<string, string>;
    sounds?: Record<string, string>;
  };
}

/**
 * Error for a file Voxa cannot import (malformed JSON, not an OBF board,
 * unsafe or oversized archive). Routes answer 400 with `message` and `code`.
 */
export class ObfImportError extends Error {
  readonly status = 400;
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ObfImportError';
  }
}

export function isObfImportError(err: unknown): err is ObfImportError {
  return err instanceof ObfImportError;
}

/** `#rrggbb` / `#rgb` → `rgb(r, g, b)`; already-rgb values pass through; anything else → undefined. */
export function toObfColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const trimmed = color.trim();
  if (/^rgba?\(/i.test(trimmed)) return trimmed;
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed)?.[1];
  if (!hex) return undefined;
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

/** `rgb()/rgba()` or hex → lowercase `#rrggbb`, or undefined. */
export function obfColorToHex(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const trimmed = color.trim();
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(trimmed);
  if (rgb) {
    return `#${[rgb[1], rgb[2], rgb[3]]
      .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0'))
      .join('')}`;
  }
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed)?.[1];
  if (!hex) return undefined;
  return `#${(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex).toLowerCase()}`;
}

const LOCALE = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/;

/** `es_MX` / `es-mx` → `es-MX`; invalid → undefined. */
export function normalizeObfLocale(locale: unknown): string | undefined {
  if (typeof locale !== 'string' || !LOCALE.test(locale.trim())) return undefined;
  const [lang, ...rest] = locale.trim().replace(/_/g, '-').split('-');
  return [lang!.toLowerCase(), ...rest.map((part) => (part.length === 2 ? part.toUpperCase() : part))].join('-');
}
