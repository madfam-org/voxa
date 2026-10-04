/**
 * The device editor PIN: a 4–8 digit code that keeps the communicator from
 * switching the board into editing on a shared device.
 *
 * The PIN is never stored. `localStorage` keeps a salted PBKDF2-SHA-256 hash
 * (WebCrypto), `pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>`, and a
 * candidate is checked by hashing it with the same salt and comparing in
 * constant time. A PIN stored in plain text by an earlier version is accepted
 * once and replaced by its hash on that first successful unlock.
 *
 * Scope: this is a lock against casual access on the device, not a secret
 * vault. A 4-digit PIN has 10,000 values, so anyone who can read this
 * browser's storage can still try them all offline; the hash keeps the PIN
 * itself out of storage, backups and anything that copies it.
 */
const PIN_STORAGE_KEY = 'voxa-editor-pin';
const UNLOCK_SESSION_KEY = 'voxa-editor-unlocked';

const PIN_FORMAT = /^\d{4,8}$/;
const HASH_SCHEME = 'pbkdf2-sha256';
/**
 * PBKDF2 rounds. WebCrypto runs PBKDF2 natively; this count costs roughly a
 * tenth of a second on a low-end Android tablet and far less on a laptop. It
 * is stored with each hash, so raising it later keeps old hashes valid.
 */
export const EDITOR_PIN_PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function hasSessionStorage(): boolean {
  return typeof sessionStorage !== 'undefined';
}

function subtleCrypto(): SubtleCrypto | null {
  // WebCrypto's subtle API exists only in secure contexts (https, localhost).
  return typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null;
}

function storedPinRecord(): string | null {
  if (!hasLocalStorage()) return null;
  return localStorage.getItem(PIN_STORAGE_KEY);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array | null {
  try {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Compares two byte strings in time that depends only on their length. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const subtle = subtleCrypto();
  if (!subtle) throw new Error('WebCrypto unavailable');
  const key = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

interface PinHashRecord {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

function parsePinHash(record: string): PinHashRecord | null {
  const [scheme, iterationsText, saltText, hashText, ...rest] = record.split('$');
  if (scheme !== HASH_SCHEME || rest.length > 0 || !iterationsText || !saltText || !hashText) return null;
  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations < 1) return null;
  const salt = fromBase64(saltText);
  const hash = fromBase64(hashText);
  if (!salt || !hash || salt.length === 0 || hash.length === 0) return null;
  return { iterations, salt, hash };
}

/** The storage record for `pin`: a fresh random salt and its PBKDF2 hash. */
export async function hashEditorPin(pin: string, iterations = EDITOR_PIN_PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(pin, salt, iterations);
  return [HASH_SCHEME, String(iterations), toBase64(salt), toBase64(hash)].join('$');
}

/** True when `record` is a hash record (not a legacy plain-text PIN). */
export function isHashedPinRecord(record: string): boolean {
  return parsePinHash(record) !== null;
}

/**
 * Checks `pin` against a stored record. A legacy plain-text record is
 * compared in constant time too. An unreadable record never matches.
 */
export async function verifyEditorPin(pin: string, record: string): Promise<boolean> {
  if (!PIN_FORMAT.test(pin)) return false;
  const parsed = parsePinHash(record);
  const encoder = new TextEncoder();
  if (!parsed) {
    return PIN_FORMAT.test(record) && constantTimeEqual(encoder.encode(pin), encoder.encode(record));
  }
  if (!subtleCrypto()) return false;
  const candidate = await pbkdf2(pin, parsed.salt, parsed.iterations);
  return constantTimeEqual(candidate, parsed.hash);
}

/**
 * Stores the hash of `pin` (4–8 digits) and locks the editor for this
 * session. Rejects when the format is wrong or when storage or WebCrypto is
 * unavailable: the PIN is never written in plain text.
 */
export async function setEditorPin(pin: string): Promise<void> {
  if (!PIN_FORMAT.test(pin)) {
    throw new Error('PIN must be 4–8 digits');
  }
  if (!hasLocalStorage()) {
    throw new Error('localStorage unavailable');
  }
  const record = await hashEditorPin(pin);
  localStorage.setItem(PIN_STORAGE_KEY, record);
  if (hasSessionStorage()) {
    sessionStorage.removeItem(UNLOCK_SESSION_KEY);
  }
}

export function clearEditorPin(): void {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(PIN_STORAGE_KEY);
  if (hasSessionStorage()) {
    sessionStorage.removeItem(UNLOCK_SESSION_KEY);
  }
}

export function isEditorUnlocked(): boolean {
  if (!hasLocalStorage()) return true;
  if (!storedPinRecord()) return true;
  if (!hasSessionStorage()) return false;
  return sessionStorage.getItem(UNLOCK_SESSION_KEY) === '1';
}

/**
 * Unlocks the editor for this session when `pin` matches. A matching legacy
 * plain-text PIN is replaced by its hash here; if hashing is unavailable the
 * unlock still succeeds and the migration waits for the next unlock.
 */
export async function unlockEditor(pin: string): Promise<boolean> {
  const record = storedPinRecord();
  if (!record) return false;
  if (!(await verifyEditorPin(pin, record))) return false;
  if (!hasSessionStorage()) return false;
  if (!isHashedPinRecord(record)) {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, await hashEditorPin(pin));
    } catch {
      // No WebCrypto (insecure context) or storage refused: keep the old record.
    }
  }
  sessionStorage.setItem(UNLOCK_SESSION_KEY, '1');
  return true;
}

export function lockEditorSession(): void {
  if (!hasSessionStorage()) return;
  sessionStorage.removeItem(UNLOCK_SESSION_KEY);
}

export function editorPinIsConfigured(): boolean {
  return Boolean(storedPinRecord());
}
