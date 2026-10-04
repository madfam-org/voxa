/**
 * Choosing among the voices the device already has (Web Speech API).
 *
 * Pure functions over a stubbable voice list: ranking, the best voice for a
 * locale, honouring a stored choice and falling back when it is gone, and a
 * bounded wait for browsers that load voices late (or never fire
 * `voiceschanged`). No licensed or cloud voice is involved: quality hints come
 * only from what the voice's own name says, plus `localService`.
 */

/** The fields of `SpeechSynthesisVoice` Voxa reads. */
export interface VoiceLike {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

/** Words found in a voice's name, shown to the user as-is (never inferred). */
export type VoiceNameHint = 'premium' | 'enhanced' | 'natural' | 'neural' | 'google' | 'online';

/** How a voice's language relates to the locale being spoken. */
export type VoiceLocaleMatch = 'exact' | 'neighbour' | 'language' | 'none';

export interface RankedVoice<V extends VoiceLike = VoiceLike> {
  voice: V;
  match: VoiceLocaleMatch;
  hints: VoiceNameHint[];
  /** True when the browser reports the voice needs a network service. */
  needsNetwork: boolean;
  score: number;
}

/** BCP 47 tag in canonical case: `es_mx` / `ES-mx` → `es-MX`. */
export function normalizeLang(lang: string): string {
  const parts = lang.trim().replace(/_/g, '-').split('-').filter(Boolean);
  if (parts.length === 0) return '';
  const [language, ...rest] = parts;
  return [
    language!.toLowerCase(),
    ...rest.map((part) => (part.length === 2 ? part.toUpperCase() : part.length === 4 ? part[0]!.toUpperCase() + part.slice(1).toLowerCase() : part)),
  ].join('-');
}

function primaryLanguage(lang: string): string {
  return normalizeLang(lang).split('-')[0] ?? '';
}

function region(lang: string): string | undefined {
  return normalizeLang(lang)
    .split('-')
    .slice(1)
    .find((part) => /^[A-Z]{2}$|^\d{3}$/.test(part));
}

/** Spanish variants spoken in the Americas: closer to es-MX than es-ES is. */
const AMERICAS_SPANISH_REGIONS = new Set([
  'MX', 'US', '419', 'AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'GT', 'HN', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'UY', 'VE',
]);

export function voiceLocaleMatch(voiceLang: string, locale: string): VoiceLocaleMatch {
  const voice = normalizeLang(voiceLang);
  const target = normalizeLang(locale);
  if (!voice || !target) return 'none';
  if (voice === target) return 'exact';
  if (primaryLanguage(voice) !== primaryLanguage(target)) return 'none';
  const voiceRegion = region(voice);
  const targetRegion = region(target);
  if (
    primaryLanguage(target) === 'es' &&
    voiceRegion &&
    targetRegion &&
    AMERICAS_SPANISH_REGIONS.has(voiceRegion) &&
    AMERICAS_SPANISH_REGIONS.has(targetRegion)
  ) {
    return 'neighbour';
  }
  return 'language';
}

const HINT_PATTERNS: Array<[VoiceNameHint, RegExp]> = [
  ['premium', /\bpremium\b/i],
  ['enhanced', /\benhanced\b|\bmejorad[ao]\b|\bam[ée]lior[ée]e?\b/i],
  ['natural', /\bnatural\b/i],
  ['neural', /\bneural\b/i],
  ['google', /\bgoogle\b/i],
  ['online', /\bonline\b|\ben l[ií]nea\b|\ben ligne\b/i],
];

/** Hints taken literally from the voice name. */
export function voiceNameHints(name: string): VoiceNameHint[] {
  return HINT_PATTERNS.filter(([, pattern]) => pattern.test(name)).map(([hint]) => hint);
}

/**
 * Apple's novelty voices (sound effects, not speech for a person). They sort
 * last within their language so nobody lands on "Bubbles" by default.
 */
const NOVELTY_VOICE = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;

const MATCH_SCORE: Record<VoiceLocaleMatch, number> = { exact: 3000, neighbour: 2000, language: 1000, none: 0 };
const HINT_SCORE: Record<VoiceNameHint, number> = {
  premium: 70,
  enhanced: 50,
  natural: 50,
  neural: 50,
  google: 30,
  online: 20,
};

/** Rank every voice for `locale`: language match first, then quality hints in the name. */
export function rankVoices<V extends VoiceLike>(voices: readonly V[], locale: string): RankedVoice<V>[] {
  return voices
    .map((voice, index) => {
      const match = voiceLocaleMatch(voice.lang, locale);
      const hints = voiceNameHints(voice.name);
      let score = MATCH_SCORE[match];
      score += Math.max(0, ...hints.map((hint) => HINT_SCORE[hint]));
      if (!voice.localService) score += 10;
      if (voice.default && match !== 'none') score += 5;
      if (NOVELTY_VOICE.test(voice.name)) score -= 500;
      return { voice, match, hints, needsNetwork: !voice.localService, score, index };
    })
    .sort((a, b) => b.score - a.score || a.voice.name.localeCompare(b.voice.name) || a.index - b.index)
    .map(({ index: _index, ...ranked }) => ranked);
}

export interface VoiceGroups<V extends VoiceLike = VoiceLike> {
  /** Voices for exactly the locale (es-MX). */
  exact: RankedVoice<V>[];
  /** Other variants of the same language (es-US, es-419, es-ES …). */
  sameLanguage: RankedVoice<V>[];
  /** Everything else, for the "show all" list. */
  other: RankedVoice<V>[];
}

export function groupVoicesForLocale<V extends VoiceLike>(voices: readonly V[], locale: string): VoiceGroups<V> {
  const ranked = rankVoices(voices, locale);
  return {
    exact: ranked.filter((r) => r.match === 'exact'),
    sameLanguage: ranked.filter((r) => r.match === 'neighbour' || r.match === 'language'),
    other: ranked.filter((r) => r.match === 'none'),
  };
}

/** The best voice for the locale's language, or null when the device has none. */
export function bestVoiceForLocale<V extends VoiceLike>(voices: readonly V[], locale: string): V | null {
  const top = rankVoices(voices, locale)[0];
  return top && top.match !== 'none' ? top.voice : null;
}

/** True when the device has at least one voice for the locale's language. */
export function hasVoiceForLocale(voices: readonly VoiceLike[], locale: string): boolean {
  return voices.some((voice) => voiceLocaleMatch(voice.lang, locale) !== 'none');
}

export interface VoiceResolution<V extends VoiceLike = VoiceLike> {
  /** Voice to speak with; null lets the browser pick from `lang` alone. */
  voice: V | null;
  /** 'chosen': the stored choice; 'best': ranked best for the locale; 'none': no voice for the language. */
  source: 'chosen' | 'best' | 'none';
  /** A voice was chosen for this locale but is not on this device any more. */
  chosenMissing: boolean;
}

/**
 * Voice for speaking `locale`. A stored choice wins while the device still
 * has it (even one picked from "show all"); otherwise the best ranked voice
 * for the locale's language, flagging `chosenMissing` so the UI can say so
 * once. With no voice for the language, `voice` is null and the browser
 * speaks with whatever it maps `lang` to.
 */
export function resolveVoice<V extends VoiceLike>(
  voices: readonly V[],
  locale: string,
  chosenVoiceURI?: string,
): VoiceResolution<V> {
  if (chosenVoiceURI) {
    const chosen = voices.find((voice) => voice.voiceURI === chosenVoiceURI);
    if (chosen) return { voice: chosen, source: 'chosen', chosenMissing: false };
  }
  // Voices load asynchronously: an empty list is "not loaded yet", not "gone".
  const chosenMissing = Boolean(chosenVoiceURI) && voices.length > 0;
  const best = bestVoiceForLocale(voices, locale);
  return { voice: best, source: best ? 'best' : 'none', chosenMissing };
}

/**
 * The stored voice choice for `locale`: an exact key first (`es-MX`), then
 * any choice stored for another variant of the same language.
 */
export function chosenVoiceForLocale(
  voiceURIByLocale: Readonly<Record<string, string>>,
  locale: string,
): string | undefined {
  const target = normalizeLang(locale);
  const exact = Object.entries(voiceURIByLocale).find(([key]) => normalizeLang(key) === target);
  if (exact) return exact[1];
  const language = primaryLanguage(target);
  return Object.entries(voiceURIByLocale).find(([key]) => primaryLanguage(key) === language)?.[1];
}

/** The part of `SpeechSynthesis` that voice loading needs (stubbable in tests). */
export interface VoiceSource<V extends VoiceLike = VoiceLike> {
  getVoices(): V[];
  addEventListener?(type: 'voiceschanged', listener: () => void): void;
  removeEventListener?(type: 'voiceschanged', listener: () => void): void;
}

export interface LoadVoicesOptions {
  /** Poll interval while the list is empty (some browsers never fire `voiceschanged`). */
  retryIntervalMs?: number;
  /** Give up after this long and resolve with whatever the list holds (possibly empty). */
  timeoutMs?: number;
}

/**
 * The device's voices. Resolves at once when the list is already filled,
 * otherwise on the first `voiceschanged` or the first non-empty poll, and
 * always by `timeoutMs`: it never waits forever.
 */
export function loadVoices<V extends VoiceLike>(
  source: VoiceSource<V>,
  { retryIntervalMs = 250, timeoutMs = 3000 }: LoadVoicesOptions = {},
): Promise<V[]> {
  const initial = safeVoices(source);
  if (initial.length > 0) return Promise.resolve(initial);

  return new Promise<V[]>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(deadline);
      source.removeEventListener?.('voiceschanged', onChange);
      resolve(safeVoices(source));
    };
    const onChange = () => {
      if (safeVoices(source).length > 0) finish();
    };
    const poll = setInterval(onChange, retryIntervalMs);
    const deadline = setTimeout(finish, timeoutMs);
    source.addEventListener?.('voiceschanged', onChange);
  });
}

function safeVoices<V extends VoiceLike>(source: VoiceSource<V>): V[] {
  try {
    return source.getVoices() ?? [];
  } catch {
    return [];
  }
}

/** Speech tuning applied to every utterance. */
export interface SpeechTuning {
  rate: number;
  pitch: number;
  volume: number;
}

export const DEFAULT_SPEECH_TUNING: SpeechTuning = { rate: 1, pitch: 1, volume: 1 };

/** Slider bounds (Web Speech allows wider ranges; these stay intelligible). */
export const SPEECH_RATE_MIN = 0.5;
export const SPEECH_RATE_MAX = 2;
export const SPEECH_PITCH_MIN = 0.5;
export const SPEECH_PITCH_MAX = 2;
export const SPEECH_VOLUME_MIN = 0;
export const SPEECH_VOLUME_MAX = 1;
export const SPEECH_TUNING_STEP = 0.1;

/**
 * "Higher voice (approximation)": the chosen adult voice raised in pitch and
 * slightly faster. It is not a child voice and the UI never calls it one.
 */
export const HIGHER_VOICE_PRESET: Pick<SpeechTuning, 'rate' | 'pitch'> = { rate: 1.1, pitch: 1.6 };

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
}

export function normalizeSpeechTuning(raw: Partial<Record<keyof SpeechTuning, unknown>> | undefined): SpeechTuning {
  return {
    rate: clamp(raw?.rate, SPEECH_RATE_MIN, SPEECH_RATE_MAX, DEFAULT_SPEECH_TUNING.rate),
    pitch: clamp(raw?.pitch, SPEECH_PITCH_MIN, SPEECH_PITCH_MAX, DEFAULT_SPEECH_TUNING.pitch),
    volume: clamp(raw?.volume, SPEECH_VOLUME_MIN, SPEECH_VOLUME_MAX, DEFAULT_SPEECH_TUNING.volume),
  };
}

/** Stored per-locale choices, keeping only string → string entries. */
export function normalizeVoiceChoices(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [locale, uri] of Object.entries(raw as Record<string, unknown>)) {
    const key = normalizeLang(locale);
    if (key && typeof uri === 'string' && uri) out[key] = uri;
  }
  return out;
}
