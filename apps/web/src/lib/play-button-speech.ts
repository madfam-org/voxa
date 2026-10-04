import type { BoardButton } from '@voxa/core';
import { buttonMediaVideo, buttonRecordedSpeech, resolveButtonSpeech } from '@voxa/core';
import { displayMediaUrl } from './media-url';
import {
  chosenVoiceForLocale,
  DEFAULT_SPEECH_TUNING,
  resolveVoice,
  type SpeechTuning,
  type VoiceResolution,
} from './speech-voices';

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

/** Utterances whose activity is still held, so a test reset can stop their timers. */
const heldUtterances = new Set<() => void>();

/** @internal test helper */
export function resetSpeechActivityForTests(): void {
  for (const stop of [...heldUtterances]) stop();
  heldUtterances.clear();
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

/**
 * Voice and tuning for every utterance Voxa speaks. Set from the device's
 * communicator settings (`configureSpeech`); the public demo keeps the
 * defaults, which still pick the best installed voice for the locale.
 */
export interface SpeechPreferences extends SpeechTuning {
  /** Chosen `voiceURI` per speech locale (`es-MX` → a voice on this device). */
  voiceURIByLocale: Record<string, string>;
}

export const DEFAULT_SPEECH_PREFERENCES: SpeechPreferences = {
  ...DEFAULT_SPEECH_TUNING,
  voiceURIByLocale: {},
};

let speechPreferences: SpeechPreferences = DEFAULT_SPEECH_PREFERENCES;

export function configureSpeech(preferences: Partial<SpeechPreferences>): void {
  speechPreferences = { ...speechPreferences, ...preferences };
}

/** @internal test helper */
export function resetSpeechPreferencesForTests(): void {
  speechPreferences = DEFAULT_SPEECH_PREFERENCES;
}

function speechSynthesisOrNull(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis ?? null;
}

/** The device's voices right now (empty while the browser is still loading them). */
export function deviceVoices(): SpeechSynthesisVoice[] {
  try {
    return speechSynthesisOrNull()?.getVoices?.() ?? [];
  } catch {
    return [];
  }
}

/** Which voice Voxa would use for `locale` now, and whether a stored choice is gone. */
export function resolveSpeechVoice(
  locale: string,
  preferences: Pick<SpeechPreferences, 'voiceURIByLocale'> = speechPreferences,
): VoiceResolution<SpeechSynthesisVoice> {
  return resolveVoice(deviceVoices(), locale, chosenVoiceForLocale(preferences.voiceURIByLocale, locale));
}

export interface UtteranceOverrides extends Partial<SpeechTuning> {
  /** Speak with this voice instead of the stored choice (settings preview). */
  voiceURI?: string;
}

/**
 * The one place an utterance is built: `lang` is the speech locale, the voice
 * is the stored choice for it (else the best installed match), and rate, pitch
 * and volume come from the communicator's tuning.
 */
function buildUtterance(text: string, locale: string, overrides: UtteranceOverrides = {}): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  const voiceChoices = overrides.voiceURI
    ? { voiceURIByLocale: { [locale]: overrides.voiceURI } }
    : speechPreferences;
  const { voice } = resolveSpeechVoice(locale, voiceChoices);
  if (voice) utterance.voice = voice;
  utterance.rate = overrides.rate ?? speechPreferences.rate;
  utterance.pitch = overrides.pitch ?? speechPreferences.pitch;
  utterance.volume = overrides.volume ?? speechPreferences.volume;
  return utterance;
}

/**
 * How long one utterance may hold the scan pause when the engine never says it
 * finished. Some Android and iOS voices, and backgrounded pages, drop `end`
 * and `error`; without a bound, switch scanning would stay paused for good.
 */
export const SPEECH_PAUSE_MIN_MS = 2000;
export const SPEECH_PAUSE_MAX_MS = 15000;
/** Characters per second at rate 1: a slow, child-paced speaking rate, so the bound errs long. */
const SPEECH_CHARS_PER_SECOND = 12;
const SPEECH_PAUSE_MARGIN_MS = 1000;
/** While an utterance is tracked, the engine is checked this often for having gone idle. */
export const SPEECH_IDLE_POLL_MS = 250;
/** The engine is not asked whether it is idle before this: `speaking` is still false right after `speak()`. */
export const SPEECH_IDLE_GRACE_MS = 750;

/**
 * Upper bound, in ms, for speaking `text` at `rate`: its length at a slow
 * speaking pace plus a margin, never under 2 s nor over 15 s.
 */
export function estimateUtteranceMs(text: string, rate = 1): number {
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const chars = text.trim().length;
  const ms = (chars / (SPEECH_CHARS_PER_SECOND * safeRate)) * 1000 + SPEECH_PAUSE_MARGIN_MS;
  return Math.round(Math.min(SPEECH_PAUSE_MAX_MS, Math.max(SPEECH_PAUSE_MIN_MS, ms)));
}

/**
 * Holds speech activity (and so the scan pause) for one utterance until the
 * first of: `end`, `error`, the engine reporting it is idle (`speaking` and
 * `pending` both false), or the bound from `estimateUtteranceMs`. The bound
 * restarts when the utterance actually starts (it may wait behind another);
 * a `start` that arrives after the bound already released it holds the pause
 * again for this utterance's own length.
 */
function trackUtteranceActivity(synth: SpeechSynthesis, utterance: SpeechSynthesisUtterance, boundMs: number): void {
  let active = false;
  let finished = false;
  let bound: ReturnType<typeof setTimeout> | undefined;
  let idlePoll: ReturnType<typeof setInterval> | undefined;

  const release = () => {
    if (bound !== undefined) clearTimeout(bound);
    if (idlePoll !== undefined) clearInterval(idlePoll);
    bound = undefined;
    idlePoll = undefined;
    heldUtterances.delete(release);
    if (active) {
      active = false;
      endSpeechActivity();
    }
  };

  const hold = () => {
    if (finished) return;
    if (!active) {
      active = true;
      heldUtterances.add(release);
      beginSpeechActivity();
    }
    if (bound !== undefined) clearTimeout(bound);
    bound = setTimeout(release, boundMs);
    if (idlePoll === undefined && typeof synth.speaking === 'boolean') {
      const heldAt = Date.now();
      idlePoll = setInterval(() => {
        if (Date.now() - heldAt < SPEECH_IDLE_GRACE_MS) return;
        if (!synth.speaking && !synth.pending) release();
      }, SPEECH_IDLE_POLL_MS);
    }
  };

  const finish = () => {
    finished = true;
    release();
  };

  utterance.onstart = () => hold();
  utterance.onend = finish;
  utterance.onerror = finish;
  hold();
}

function speakWithTts(text: string, locale: string, overrides?: UtteranceOverrides): void {
  const synth = speechSynthesisOrNull();
  if (!synth) return;
  const utterance = buildUtterance(text, locale, overrides);
  trackUtteranceActivity(synth, utterance, estimateUtteranceMs(text, utterance.rate));
  synth.speak(utterance);
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

/**
 * Preview a voice from settings: cancels what is playing, then speaks `text`
 * with `voiceURI` and the given tuning (not yet saved).
 */
export function previewVoice(text: string, locale: string, overrides: UtteranceOverrides): void {
  speechSynthesisOrNull()?.cancel();
  speakWithTts(text, locale, overrides);
}

/** Scan cues sit slightly below the communicator's own speech volume. */
export const SCAN_CUE_VOLUME_FACTOR = 0.85;

/**
 * Speak a scanned button label without affecting scan-pause activity
 * tracking. Same voice and tuning as everything else, a little quieter.
 */
export function announceScanLabel(label: string, locale: string): void {
  const synth = speechSynthesisOrNull();
  if (!synth) return;
  synth.cancel();
  synth.speak(
    buildUtterance(label, locale, { volume: speechPreferences.volume * SCAN_CUE_VOLUME_FACTOR }),
  );
}
