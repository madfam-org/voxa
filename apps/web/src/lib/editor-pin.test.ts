import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

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

  it('requires unlock after PIN is set', async () => {
    const {
      clearEditorPin,
      getEditorPin,
      isEditorUnlocked,
      setEditorPin,
      unlockEditor,
    } = await import('./editor-pin.js');

    setEditorPin('1234');
    assert.equal(getEditorPin(), '1234');
    assert.equal(isEditorUnlocked(), false);
    assert.equal(unlockEditor('9999'), false);
    assert.equal(unlockEditor('1234'), true);
    assert.equal(isEditorUnlocked(), true);
    clearEditorPin();
  });

  it('locks session when returning to communicator flow', async () => {
    const { isEditorUnlocked, lockEditorSession, setEditorPin, unlockEditor } = await import('./editor-pin.js');

    setEditorPin('5678');
    unlockEditor('5678');
    lockEditorSession();
    assert.equal(isEditorUnlocked(), false);
  });

  it('rejects invalid PIN format', async () => {
    const { editorPinIsConfigured, setEditorPin } = await import('./editor-pin.js');

    await assert.rejects(async () => setEditorPin('abc'), /4–8 digits/);
    assert.equal(editorPinIsConfigured(), false);
  });
});
