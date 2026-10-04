/** Base64 → bytes; `undefined` when the text is not base64. */
export function decodeBase64(text: string): Uint8Array | undefined {
  const clean = text.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return undefined;
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(clean, 'base64'));
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/**
 * Media type from the file's own bytes (never from a name or a declared
 * type), limited to what Voxa's media store accepts: PNG, JPEG, GIF and WebP
 * pictures; MP3, WAV, Ogg, WebM and MP4 sound. SVG and everything else →
 * `undefined` (not imported).
 */
export function sniffMediaType(bytes: Uint8Array, kind: 'image' | 'sound'): string | undefined {
  if (bytes.byteLength < 12) return undefined;
  if (kind === 'image') {
    if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (ascii(bytes, 0, 4) === 'GIF8') return 'image/gif';
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
    return undefined;
  }
  if (ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') return 'audio/wav';
  if (ascii(bytes, 0, 4) === 'OggS') return 'audio/ogg';
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'audio/webm';
  if (ascii(bytes, 4, 4) === 'ftyp') return 'audio/mp4';
  return undefined;
}
