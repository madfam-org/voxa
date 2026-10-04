import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';

const PIN_KEY = 'voxa-editor-pin';

function createStorage(backing: Record<string, string>): Storage {
  return {
    get length() {
      return Object.keys(backing).length;
    },
    clear() {
      for (const key of Object.keys(backing)) delete backing[key];
    },
    getItem(key: string) {
      return backing[key] ?? null;
    },
    key(index: number) {
      return Object.keys(backing)[index] ?? null;
    },
    removeItem(key: string) {
      delete backing[key];
    },
    setItem(key: string, value: string) {
      backing[key] = value;
    },
  };
}

describe('editor-pin', () => {
  let localBacking: Record<string, string>;
  let sessionBacking: Record<string, string>;

  beforeEach(() => {
    localBacking = {};
    sessionBacking = {};
    (globalThis as typeof globalThis & { localStorage: Storage; sessionStorage: Storage }).localStorage =
      createStorage(localBacking);
    (globalThis as typeof globalThis & { localStorage: Storage; sessionStorage: Storage }).sessionStorage =
      createStorage(sessionBacking);
  });

  it('allows editor access when no PIN configured', async () => {
    const { editorPinIsConfigured, isEditorUnlocked } = await import('./editor-pin.js');
    assert.equal(editorPinIsConfigured(), false);
    assert.equal(isEditorUnlocked(), true);
  });

  it('stores a salted PBKDF2 hash, never the PIN', async () => {
    const { EDITOR_PIN_PBKDF2_ITERATIONS, isHashedPinRecord, setEditorPin } = await import('./editor-pin.js');

    await setEditorPin('1234');
    const record = localBacking[PIN_KEY]!;
    assert.ok(record, 'a record is stored');
    assert.equal(record.includes('1234'), false, 'the PIN does not appear in storage');
    assert.equal(isHashedPinRecord(record), true);
    const [scheme, iterations, salt, hash] = record.split('$');
    assert.equal(scheme, 'pbkdf2-sha256');
    assert.equal(Number(iterations), EDITOR_PIN_PBKDF2_ITERATIONS);
    assert.equal(Buffer.from(salt!, 'base64').length, 16, '16-byte salt');
    assert.equal(Buffer.from(hash!, 'base64').length, 32, '256-bit hash');

    // The same PIN set twice gets a different salt, so a different record.
    await setEditorPin('1234');
    assert.notEqual(localBacking[PIN_KEY], record);
  });

  it('the hash is PBKDF2-SHA-256 of the PIN with the stored salt and rounds', async () => {
    const { hashEditorPin } = await import('./editor-pin.js');
    const record = await hashEditorPin('5678', 1000);
    const [, iterations, salt, hash] = record.split('$');
    const expected = pbkdf2Sync('5678', Buffer.from(salt!, 'base64'), Number(iterations), 32, 'sha256');
    assert.equal(Buffer.from(hash!, 'base64').equals(expected), true);
  });

  it('requires unlock after PIN is set; a wrong PIN never unlocks', async () => {
    const { clearEditorPin, editorPinIsConfigured, isEditorUnlocked, setEditorPin, unlockEditor } = await import(
      './editor-pin.js'
    );

    await setEditorPin('1234');
    assert.equal(editorPinIsConfigured(), true);
    assert.equal(isEditorUnlocked(), false);
    assert.equal(await unlockEditor('9999'), false);
    assert.equal(await unlockEditor('12345'), false);
    assert.equal(await unlockEditor('123'), false);
    assert.equal(await unlockEditor(''), false);
    assert.equal(isEditorUnlocked(), false);
    assert.equal(await unlockEditor('1234'), true);
    assert.equal(isEditorUnlocked(), true);
    clearEditorPin();
    assert.equal(editorPinIsConfigured(), false);
  });

  it('migrates a plain-text PIN from an earlier version on the first successful unlock', async () => {
    const { isEditorUnlocked, isHashedPinRecord, unlockEditor, verifyEditorPin } = await import('./editor-pin.js');

    localBacking[PIN_KEY] = '2468';
    assert.equal(isEditorUnlocked(), false);
    assert.equal(await unlockEditor('1357'), false);
    assert.equal(localBacking[PIN_KEY], '2468', 'a wrong PIN does not migrate');

    assert.equal(await unlockEditor('2468'), true);
    const record = localBacking[PIN_KEY]!;
    assert.equal(isHashedPinRecord(record), true, 'replaced by its hash');
    assert.equal(record.includes('2468'), false);
    assert.equal(await verifyEditorPin('2468', record), true, 'the same PIN still unlocks');
    assert.equal(await verifyEditorPin('1357', record), false);
  });

  it('an unreadable record never matches', async () => {
    const { verifyEditorPin } = await import('./editor-pin.js');
    assert.equal(await verifyEditorPin('1234', 'pbkdf2-sha256$abc$$'), false);
    assert.equal(await verifyEditorPin('1234', 'pbkdf2-sha256$1000$%%%$%%%'), false);
    assert.equal(await verifyEditorPin('1234', 'something else'), false);
  });

  it('compares in constant time over the longer input', async () => {
    const { constantTimeEqual } = await import('./editor-pin.js');
    const bytes = (...values: number[]) => new Uint8Array(values);
    assert.equal(constantTimeEqual(bytes(1, 2, 3), bytes(1, 2, 3)), true);
    assert.equal(constantTimeEqual(bytes(1, 2, 3), bytes(1, 2, 4)), false);
    assert.equal(constantTimeEqual(bytes(1, 2, 3), bytes(1, 2)), false);
    assert.equal(constantTimeEqual(bytes(), bytes()), true);
  });

  it('locks session when returning to communicator flow', async () => {
    const { isEditorUnlocked, lockEditorSession, setEditorPin, unlockEditor } = await import('./editor-pin.js');

    await setEditorPin('5678');
    assert.equal(await unlockEditor('5678'), true);
    lockEditorSession();
    assert.equal(isEditorUnlocked(), false);
  });

  it('rejects invalid PIN format', async () => {
    const { editorPinIsConfigured, setEditorPin } = await import('./editor-pin.js');

    await assert.rejects(async () => setEditorPin('abc'), /4–8 digits/);
    await assert.rejects(async () => setEditorPin('123'), /4–8 digits/);
    await assert.rejects(async () => setEditorPin('123456789'), /4–8 digits/);
    assert.equal(editorPinIsConfigured(), false);
  });
});
