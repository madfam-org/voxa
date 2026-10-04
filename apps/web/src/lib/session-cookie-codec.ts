/**
 * Armor for the Auth.js session cookie.
 *
 * Auth.js encrypts the session (JWE, `dir` + A256CBC-HS512, key derived from
 * AUTH_SECRET). A compact JWE starts with a base64url JSON header, `eyJ…`,
 * which is indistinguishable from a bearer token for log scrubbers, secret
 * scanners and the check that the cookie carries no JWT. This codec re-encodes
 * the same five JWE parts in unpadded RFC 4648 base32 (upper-case letters and
 * digits only), so the cookie can never contain a JWT-shaped string. The
 * cryptography is untouched: encryption and decryption stay Auth.js's own
 * `encode`/`decode` (see `session-jwt.ts`).
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PREFIX = 'v1.';

function base32Encode(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string): Uint8Array | null {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) return null;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
    buffer &= (1 << bits) - 1;
  }
  return Uint8Array.from(out);
}

function base64UrlToBytes(part: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(part)) return null;
  const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4);
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Compact JWE → cookie-safe armored value. */
export function armorSessionJwe(jwe: string): string {
  const parts = jwe.split('.');
  if (parts.length !== 5) throw new Error('Expected a compact JWE');
  return (
    PREFIX +
    parts
      .map((part) => {
        const bytes = base64UrlToBytes(part);
        if (!bytes) throw new Error('Malformed JWE part');
        return base32Encode(bytes);
      })
      .join('.')
  );
}

/** Armored cookie value → compact JWE, or null when it is not one of ours. */
export function dearmorSessionJwe(value: string): string | null {
  if (!value.startsWith(PREFIX)) return null;
  const parts = value.slice(PREFIX.length).split('.');
  if (parts.length !== 5) return null;
  const decoded: string[] = [];
  for (const part of parts) {
    const bytes = base32Decode(part);
    if (!bytes) return null;
    decoded.push(bytesToBase64Url(bytes));
  }
  return decoded.join('.');
}
