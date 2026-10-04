/**
 * Magic-byte check for uploaded media (A-025). The upload's declared type must
 * match what the first bytes say, so `text/html` labelled `image/png` is
 * refused. One hand-written table for exactly the types Voxa accepts
 * (`ALLOWED_MIME` in media-store.ts); permissive within a container family:
 *
 * - WebM and Matroska share the EBML header, so `audio/webm` and `video/webm`
 *   both accept it (a WebM voice note and a WebM video look alike).
 * - MP4, M4A and QuickTime are ISO BMFF: an `ftyp` box at offset 4 (QuickTime
 *   files may start with `moov`, `mdat`, `wide`, `free` or `skip` instead).
 */

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

function ascii(text: string): number[] {
  return Array.from(text, (ch) => ch.charCodeAt(0));
}

const EBML = [0x1a, 0x45, 0xdf, 0xa3];

function isIsoBmff(bytes: Uint8Array, allowQuickTimeAtoms: boolean): boolean {
  if (startsWith(bytes, ascii('ftyp'), 4)) return true;
  if (!allowQuickTimeAtoms) return false;
  return ['moov', 'mdat', 'wide', 'free', 'skip'].some((atom) => startsWith(bytes, ascii(atom), 4));
}

function isRiff(bytes: Uint8Array, form: string): boolean {
  return startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii(form), 8);
}

function isMp3(bytes: Uint8Array): boolean {
  if (startsWith(bytes, ascii('ID3'))) return true;
  // MPEG audio frame sync: 11 set bits.
  return bytes.length >= 2 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;
}

const MATCHERS: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/jpeg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  // "\x89PNG": the first half of the 8-byte signature is already unambiguous.
  'image/png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]),
  'image/gif': (b) => startsWith(b, ascii('GIF87a')) || startsWith(b, ascii('GIF89a')),
  'image/webp': (b) => isRiff(b, 'WEBP'),
  'audio/wav': (b) => isRiff(b, 'WAVE'),
  'audio/ogg': (b) => startsWith(b, ascii('OggS')),
  'audio/mpeg': isMp3,
  'audio/webm': (b) => startsWith(b, EBML),
  'video/webm': (b) => startsWith(b, EBML),
  'audio/mp4': (b) => isIsoBmff(b, false),
  'video/mp4': (b) => isIsoBmff(b, false),
  'video/quicktime': (b) => isIsoBmff(b, true),
};

/** True when the bytes look like the declared media type. Unknown types: false. */
export function mediaBytesMatchType(bytes: Uint8Array, mimeType: string): boolean {
  const matcher = MATCHERS[mimeType];
  return matcher ? matcher(bytes) : false;
}

/** The media types this table knows (kept equal to the upload allow-list by a test). */
export function sniffableMediaTypes(): string[] {
  return Object.keys(MATCHERS);
}
