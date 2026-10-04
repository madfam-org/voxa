import type { BoardButton } from '@voxa/core';
import { buttonMediaVideo, buttonRecordedSpeech, resolveButtonSpeech } from '@voxa/core';
import { displayMediaUrl } from './media-url';

type SpeechActivityListener = (active: boolean) => void;

let activeSpeechCount = 0;
const listeners = new Set<SpeechActivityListener>();

function notifySpeechActivity(): void {
  const active = activeSpeechCount > 0;
  for (const listener of listeners) listener(active);
}

function beginSpeechActivity(): void {
  activeSpeechCount += 1;
  notifySpeechActivity();
}

function endSpeechActivity(): void {
  activeSpeechCount = Math.max(0, activeSpeechCount - 1);
  notifySpeechActivity();
}

export function subscribeSpeechActivity(listener: SpeechActivityListener): () => void {
  listeners.add(listener);
  listener(activeSpeechCount > 0);
  return () => listeners.delete(listener);
}

/** @internal test helper */
export function resetSpeechActivityForTests(): void {
  activeSpeechCount = 0;
  notifySpeechActivity();
}

export interface SpeakButtonOptions {
  /** The text the button speaks; also the text-to-speech fallback for recorded media. */
  speechText?: string;
  /** Accessible name of the button that closes a GLP video: the catalog's `common.close`. */
  closeLabel: string;
}

interface ActiveVideo {
  close: () => void;
}

let activeVideo: ActiveVideo | null = null;

/**
 * Uploaded media is read through the same-origin proxy (`/api/media/:id`),
 * which carries the session cookie; no bearer token is handled here.
 */
async function fetchMediaBlob(url: string): Promise<Blob> {
  const res = await fetch(displayMediaUrl(url) ?? url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Media fetch failed (${res.status})`);
  return res.blob();
}

async function playBlobAudio(blob: Blob): Promise<void> {
  beginSpeechActivity();
  const blobUrl = URL.createObjectURL(blob);
  try {
    const audio = new Audio(blobUrl);
    await audio.play();
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Audio playback failed'));
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
    endSpeechActivity();
  }
}

/** Closes the GLP video on screen, if any. Any new button activation calls it. */
export function stopActiveVideo(): void {
  activeVideo?.close();
}

/**
 * Shows a GLP video in a visible dialog with the phrase as its caption. The
 * close button takes focus; any key (keyboards and key-emulating switches),
 * a tap on the backdrop or the close button, or the next button activation
 * dismisses it, and focus returns where it was. It closes itself at the end.
 */
async function playVisibleVideo(blob: Blob, caption: string, closeLabel: string): Promise<void> {
  stopActiveVideo();
  const blobUrl = URL.createObjectURL(blob);
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', caption);
  overlay.dataset.voxaGlpVideo = 'true';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '1000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '16px',
    background: 'rgba(0, 0, 0, 0.82)',
  });

  const figure = document.createElement('figure');
  Object.assign(figure.style, { margin: '0', width: 'min(92vw, 720px)', textAlign: 'center' });

  const video = document.createElement('video');
  video.src = blobUrl;
  video.playsInline = true;
  video.setAttribute('aria-label', caption);
  Object.assign(video.style, {
    display: 'block',
    width: '100%',
    minHeight: '200px',
    maxHeight: '70vh',
    background: '#000',
    borderRadius: '12px',
  });

  const figcaption = document.createElement('figcaption');
  figcaption.textContent = caption;
  Object.assign(figcaption.style, {
    marginTop: '12px',
    color: '#fff',
    fontSize: '1.5rem',
    fontWeight: '600',
    lineHeight: '1.3',
  });

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = closeLabel;
  Object.assign(closeButton.style, {
    minWidth: '160px',
    minHeight: '64px',
    padding: '12px 24px',
    fontSize: '1.25rem',
    fontWeight: '600',
    borderRadius: '12px',
    border: '3px solid #fff',
    background: '#111',
    color: '#fff',
    cursor: 'pointer',
  });

  figure.append(video, figcaption);
  overlay.append(figure, closeButton);

  beginSpeechActivity();
  let closed = false;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      closeButton.focus();
      return;
    }
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  };

  function close(): void {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeyDown, true);
    video.pause();
    overlay.remove();
    URL.revokeObjectURL(blobUrl);
    if (activeVideo === handle) activeVideo = null;
    endSpeechActivity();
    previousFocus?.focus();
    resolveDone();
  }

  const handle: ActiveVideo = { close };
  activeVideo = handle;

  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  video.addEventListener('ended', close);
  window.addEventListener('keydown', onKeyDown, true);

  document.body.appendChild(overlay);
  closeButton.focus();

  try {
    await video.play();
  } catch (err) {
    // Dismissed before playback started: nothing more to say.
    if (closed) return;
    close();
    throw err;
  }
  await done;
}

function speakWithTts(text: string, locale: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  beginSpeechActivity();
  const utterance = Object.assign(new SpeechSynthesisUtterance(text), { lang: locale });
  utterance.onend = () => endSpeechActivity();
  utterance.onerror = () => endSpeechActivity();
  window.speechSynthesis.speak(utterance);
}

/**
 * Play the button's recorded media when present, otherwise speak it. When the
 * media cannot be fetched or played (offline, expired session, unsupported
 * format) the button's speech text is spoken instead: a tap never stays silent.
 */
export async function speakButton(btn: BoardButton, options: SpeakButtonOptions): Promise<void> {
  stopActiveVideo();
  const text = options.speechText ?? resolveButtonSpeech(btn);

  const video = buttonMediaVideo(btn);
  if (video?.url) {
    try {
      const blob = await fetchMediaBlob(video.url);
      await playVisibleVideo(blob, text, options.closeLabel);
    } catch {
      speakWithTts(text, btn.locale);
    }
    return;
  }

  const audio = buttonRecordedSpeech(btn);
  if (audio?.url) {
    try {
      const blob = await fetchMediaBlob(audio.url);
      await playBlobAudio(blob);
    } catch {
      speakWithTts(text, btn.locale);
    }
    return;
  }

  speakWithTts(text, btn.locale);
}

/**
 * Speak free text (whole message, prediction, keyboard sentence) with the
 * voice for `locale`. The locale is required: callers pass the board's content
 * locale (see `speechLocaleForBoard`) so Spanish text is never read with an
 * English voice.
 */
export function speakText(text: string, locale: string): void {
  speakWithTts(text, locale);
}

/** Speak a scanned button label without affecting scan-pause activity tracking. */
export function announceScanLabel(label: string, locale = 'en-US'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = Object.assign(new SpeechSynthesisUtterance(label), { lang: locale, volume: 0.85 });
  window.speechSynthesis.speak(utterance);
}
