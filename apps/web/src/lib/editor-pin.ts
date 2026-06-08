const PIN_STORAGE_KEY = 'voxa-editor-pin';
const UNLOCK_SESSION_KEY = 'voxa-editor-unlocked';

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function hasSessionStorage(): boolean {
  return typeof sessionStorage !== 'undefined';
}

export function getEditorPin(): string | null {
  if (!hasLocalStorage()) return null;
  return localStorage.getItem(PIN_STORAGE_KEY);
}

export function setEditorPin(pin: string): void {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('PIN must be 4–8 digits');
  }
  if (!hasLocalStorage()) {
    throw new Error('localStorage unavailable');
  }
  localStorage.setItem(PIN_STORAGE_KEY, pin);
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
  if (!getEditorPin()) return true;
  if (!hasSessionStorage()) return false;
  return sessionStorage.getItem(UNLOCK_SESSION_KEY) === '1';
}

export function unlockEditor(pin: string): boolean {
  if (getEditorPin() !== pin) return false;
  if (!hasSessionStorage()) return false;
  sessionStorage.setItem(UNLOCK_SESSION_KEY, '1');
  return true;
}

export function lockEditorSession(): void {
  if (!hasSessionStorage()) return;
  sessionStorage.removeItem(UNLOCK_SESSION_KEY);
}

export function editorPinIsConfigured(): boolean {
  return Boolean(getEditorPin());
}
