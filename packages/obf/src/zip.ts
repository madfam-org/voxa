import { unzipSync } from 'fflate';
import { ObfImportError } from './spec.js';

/**
 * Limits for archives Voxa reads (.obz, .gridset, TouchChat .ce). Checked on
 * the zip's central directory *before* anything is decompressed, and again on
 * the decompressed bytes, so a zip bomb or a lying header never allocates more
 * than `maxTotalBytes`.
 */
export interface ZipLimits {
  /** Largest accepted archive (compressed bytes). */
  maxArchiveBytes: number;
  maxEntries: number;
  /** Sum of the uncompressed sizes of every entry. */
  maxTotalBytes: number;
  maxEntryBytes: number;
  /** Largest accepted uncompressed/compressed ratio for an entry over 64 KiB. */
  maxRatio: number;
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxArchiveBytes: 30 * 1024 * 1024,
  maxEntries: 2000,
  maxTotalBytes: 100 * 1024 * 1024,
  maxEntryBytes: 20 * 1024 * 1024,
  maxRatio: 100,
};

interface CentralEntry {
  name: string;
  compressedSize: number;
  size: number;
  isDirectory: boolean;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0;
}

function invalid(message: string): never {
  throw new ObfImportError(message, 'INVALID_ARCHIVE');
}

/**
 * A path inside the archive is accepted only when it is relative, uses `/`,
 * has no `..`, `.` or empty segment, no drive letter and no control character.
 * Returns the path, or throws (zip-slip).
 */
export function safeArchivePath(name: string): string {
  const unsafe =
    name.length === 0 ||
    name.length > 512 ||
    name.startsWith('/') ||
    name.includes('\\') ||
    /^[A-Za-z]:/.test(name) ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/.test(name) ||
    name
      .replace(/\/$/, '')
      .split('/')
      .some((segment) => segment === '..' || segment === '.' || segment === '');
  if (unsafe) {
    throw new ObfImportError(`Archive entry has an unsafe path: ${JSON.stringify(name.slice(0, 80))}`, 'ZIP_SLIP');
  }
  return name;
}

/** Normalise a path referenced from inside a board (`./images/a.png` → `images/a.png`). */
export function referencedArchivePath(path: string): string | undefined {
  const trimmed = path.trim().replace(/^\.\//, '');
  try {
    return safeArchivePath(trimmed);
  } catch {
    return undefined;
  }
}

function readCentralDirectory(bytes: Uint8Array, limits: ZipLimits): CentralEntry[] {
  if (bytes.byteLength < 22) invalid('Not a zip archive.');
  let eocd = -1;
  const searchFrom = Math.max(0, bytes.byteLength - 22 - 0xffff);
  for (let i = bytes.byteLength - 22; i >= searchFrom; i -= 1) {
    if (u32(bytes, i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) invalid('Not a zip archive (no end of central directory).');

  const count = u16(bytes, eocd + 10);
  const cdSize = u32(bytes, eocd + 12);
  const cdOffset = u32(bytes, eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) {
    throw new ObfImportError('ZIP64 archives are not accepted.', 'ARCHIVE_TOO_LARGE');
  }
  if (count > limits.maxEntries) {
    throw new ObfImportError(`Archive has ${count} entries; the limit is ${limits.maxEntries}.`, 'TOO_MANY_ENTRIES');
  }
  if (cdOffset + cdSize > bytes.byteLength) invalid('Corrupt zip central directory.');

  const entries: CentralEntry[] = [];
  let offset = cdOffset;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.byteLength || u32(bytes, offset) !== CENTRAL_SIGNATURE) {
      invalid('Corrupt zip central directory entry.');
    }
    const madeBy = u16(bytes, offset + 4);
    const flags = u16(bytes, offset + 8);
    const compressedSize = u32(bytes, offset + 20);
    const size = u32(bytes, offset + 24);
    const nameLength = u16(bytes, offset + 28);
    const extraLength = u16(bytes, offset + 30);
    const commentLength = u16(bytes, offset + 32);
    const externalAttributes = u32(bytes, offset + 38);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;

    safeArchivePath(name);
    if (flags & 0x1) throw new ObfImportError('Encrypted archives are not accepted.', 'INVALID_ARCHIVE');
    const hostIsUnix = madeBy >> 8 === 3;
    if (hostIsUnix && ((externalAttributes >>> 16) & S_IFMT) === S_IFLNK) {
      throw new ObfImportError(`Archive entry is a symbolic link: ${name.slice(0, 80)}`, 'ZIP_SYMLINK');
    }
    if (compressedSize === 0xffffffff || size === 0xffffffff) {
      throw new ObfImportError('ZIP64 archives are not accepted.', 'ARCHIVE_TOO_LARGE');
    }
    if (size > limits.maxEntryBytes) {
      throw new ObfImportError(`Archive entry ${name.slice(0, 80)} is too large.`, 'ARCHIVE_TOO_LARGE');
    }
    if (size > 64 * 1024 && size / Math.max(1, compressedSize) > limits.maxRatio) {
      throw new ObfImportError('Archive compression ratio is too high.', 'COMPRESSION_RATIO');
    }
    total += size;
    if (total > limits.maxTotalBytes) {
      throw new ObfImportError('Archive expands beyond the size limit.', 'ARCHIVE_TOO_LARGE');
    }
    entries.push({ name, compressedSize, size, isDirectory: name.endsWith('/') });
  }
  return entries;
}

/**
 * Unzip an untrusted archive: zip-slip paths, symbolic links, encryption,
 * ZIP64, too many entries, oversized entries or totals and suspicious
 * compression ratios are rejected with an {@link ObfImportError} (HTTP 400).
 * Directories are skipped. Returns path → bytes.
 */
export function safeUnzip(bytes: Uint8Array, overrides: Partial<ZipLimits> = {}): Map<string, Uint8Array> {
  const limits = { ...DEFAULT_ZIP_LIMITS, ...overrides };
  if (bytes.byteLength > limits.maxArchiveBytes) {
    throw new ObfImportError(
      `Archive is larger than ${Math.round(limits.maxArchiveBytes / (1024 * 1024))} MB.`,
      'ARCHIVE_TOO_LARGE',
    );
  }
  const central = readCentralDirectory(bytes, limits);
  const declared = new Map(central.map((entry) => [entry.name, entry]));

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes, {
      filter: (file) => {
        const entry = declared.get(file.name);
        // Local headers must match the central directory we checked.
        if (!entry || file.originalSize > entry.size) {
          throw new ObfImportError('Zip local header does not match its central directory.', 'INVALID_ARCHIVE');
        }
        return !entry.isDirectory;
      },
    });
  } catch (err) {
    if (err instanceof ObfImportError) throw err;
    invalid(`Unreadable zip archive: ${(err as Error).message}`);
  }

  const files = new Map<string, Uint8Array>();
  let total = 0;
  for (const [name, data] of Object.entries(unzipped)) {
    const entry = declared.get(name);
    if (!entry || data.byteLength > entry.size) {
      throw new ObfImportError('Zip entry is larger than declared.', 'ARCHIVE_TOO_LARGE');
    }
    total += data.byteLength;
    if (total > limits.maxTotalBytes) {
      throw new ObfImportError('Archive expands beyond the size limit.', 'ARCHIVE_TOO_LARGE');
    }
    files.set(name, data);
  }
  return files;
}
