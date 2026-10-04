/**
 * Open Board Format (OBF 0.1, `.obf` / `.obz`) for Voxa.
 * Spec: https://www.openboardformat.org/docs
 *
 * - Export writes spec OBF 0.1; Voxa-only data travels as `ext_voxa_*`.
 * - Import reads spec OBF/OBZ and the dialect earlier Voxa versions wrote,
 *   and always produces NEW boards (see `obfSetToVoxaBoards`).
 */
export {
  isObfImportError,
  normalizeObfLocale,
  obfColorToHex,
  OBF_FORMAT,
  ObfImportError,
  toObfColor,
  VOXA_EXT_SCHEMA,
  type ObfBoard,
  type ObfButton,
  type ObfExtensions,
  type ObfGrid,
  type ObfImage,
  type ObfLicense,
  type ObfLoadBoard,
  type ObfSound,
  type ObzManifest,
} from './spec.js';

export {
  classifySoundUrl,
  serializeObf,
  voxaBoardToObf,
  voxaBoardToObfWithSources,
  type ExportSoundSource,
  type ObfExport,
  type ObfExportOptions,
} from './export.js';

export {
  obfSetFromJson,
  obfSetToVoxaBoards,
  OBF_IMPORT_LIMITS,
  parseObfJson,
  type ImportedMedia,
  type ObfBoardSet,
  type ObfImportOptions,
  type ObfImportResult,
  type ObfImportSkipped,
  type ObfSetBoard,
  type ParsedObf,
} from './import.js';

export {
  unpackObz,
  voxaBoardsToObz,
  voxaBoardToObz,
  type ObzExportOptions,
  type ObzImageLoader,
  type ObzLoadedImage,
  type ObzSoundLoader,
} from './obz.js';

export { DEFAULT_ZIP_LIMITS, safeArchivePath, safeUnzip, type ZipLimits } from './zip.js';
export { sniffMediaType } from './media-bytes.js';

export {
  buttonImageSource,
  classifyImageUrl,
  extensionForContentType,
  obfImageFor,
  type ExportImageKind,
  type ExportImageSource,
} from './images.js';
