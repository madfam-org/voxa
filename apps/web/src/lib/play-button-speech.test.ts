import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { BoardButton } from '@voxa/core';
import {
  announceScanLabel,
  configureSpeech,
  estimateUtteranceMs,
  previewVoice,
  resetSpeechActivityForTests,
  resetSpeechPreferencesForTests,
  resolveSpeechVoice,
  SCAN_CUE_VOLUME_FACTOR,
  SPEECH_IDLE_GRACE_MS,
  SPEECH_IDLE_POLL_MS,
  SPEECH_PAUSE_MAX_MS,
  SPEECH_PAUSE_MIN_MS,
  speakButton,
  speakText,
  subscribeSpeechActivity,
} from './play-button-speech';
import type { VoiceLike } from './speech-voices';

interface FakeUtterance {
  text: string;
  onstart?: (() => void) | null;
  onend?: (() => void) | null;
  onerror?: (() => void) | null;
  lang?: string;
  voice?: VoiceLike | null;
  rate?: number;
  pitch?: number;
  volume?: number;
}

const g = globalThis as unknown as Record<string, unknown>;
let spoken: FakeUtterance[] = [];
let cancels = 0;
let voices: VoiceLike[] = [];

const voice = (name: string, lang: string): VoiceLike => ({
  voiceURI: `uri:${name}`,
  name,
  lang,
  localService: true,
  default: false,
});
const PAULINA = voice('Paulina', 'es-MX');
const MONICA = voice('Mónica', 'es-ES');
const SAMANTHA = voice('Samantha', 'en-US');

const originalFetch = globalThis.fetch;

beforeEach(() => {
  spoken = [];
  cancels = 0;
  voices = [SAMANTHA, MONICA, PAULINA];
  g.SpeechSynthesisUtterance = class {
    text: string;
    lang = '';
    voice: VoiceLike | null = null;
    rate = 1;
    pitch = 1;
    volume = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  g.window = {
    speechSynthesis: {
      speak: (u: FakeUtterance) => spoken.push(u),
      cancel: () => {
        cancels += 1;
      },
      getVoices: () => voices,
    },
  };
  resetSpeechPreferencesForTests();
  resetSpeechActivityForTests();
});

afterEach(() => {
  resetSpeechActivityForTests();
  delete g.window;
  delete g.SpeechSynthesisUtterance;
  globalThis.fetch = originalFetch;
  resetSpeechPreferencesForTests();
});

const summary = (u: FakeUtterance) => ({
  text: u.text,
  lang: u.lang,
  voiceURI: u.voice?.voiceURI ?? null,
  rate: u.rate,
  pitch: u.pitch,
  volume: u.volume,
});

describe('speech module: one voice and tuning for every utterance', () => {
  it('without a choice, speaks with the best installed voice for the locale', () => {
    speakText('hola', 'es-MX');
    assert.deepEqual(summary(spoken[0]!), {
      text: 'hola',
      lang: 'es-MX',
      voiceURI: PAULINA.voiceURI,
      rate: 1,
      pitch: 1,
      volume: 1,
    });
  });

  it('applies the chosen voice, rate, pitch and volume', () => {
    configureSpeech({ voiceURIByLocale: { 'es-MX': MONICA.voiceURI }, rate: 0.8, pitch: 1.6, volume: 0.5 });
    speakText('quiero agua', 'es-MX');
    assert.deepEqual(summary(spoken[0]!), {
      text: 'quiero agua',
      lang: 'es-MX',
      voiceURI: MONICA.voiceURI,
      rate: 0.8,
      pitch: 1.6,
      volume: 0.5,
    });
  });

  it('uses the best voice of another language for a button in that language', () => {
    configureSpeech({ voiceURIByLocale: { 'es-MX': MONICA.voiceURI } });
    speakText('hello', 'en-US');
    assert.equal(spoken[0]!.voice?.voiceURI, SAMANTHA.voiceURI);
    assert.equal(spoken[0]!.lang, 'en-US');
  });

  it('falls back to the best match when the stored voice is gone, and reports it', () => {
    configureSpeech({ voiceURIByLocale: { 'es-MX': 'uri:removed' } });
    speakText('hola', 'es-MX');
    assert.equal(spoken[0]!.voice?.voiceURI, PAULINA.voiceURI);
    assert.equal(resolveSpeechVoice('es-MX').chosenMissing, true);
  });

  it('with no voice for the language, leaves the voice unset and still speaks', () => {
    voices = [SAMANTHA];
    speakText('hola', 'es-MX');
    assert.equal(spoken.length, 1);
    assert.equal(spoken[0]!.voice, null);
    assert.equal(spoken[0]!.lang, 'es-MX');
  });

  it('scan cues use the same voice, a little quieter than speech', () => {
    configureSpeech({ voiceURIByLocale: { 'es-MX': MONICA.voiceURI }, rate: 1.2, volume: 0.6 });
    announceScanLabel('agua', 'es-MX');
    assert.equal(cancels, 1);
    const cue = summary(spoken[0]!);
    assert.equal(cue.voiceURI, MONICA.voiceURI);
    assert.equal(cue.rate, 1.2);
    assert.ok(Math.abs((cue.volume ?? 0) - 0.6 * SCAN_CUE_VOLUME_FACTOR) < 1e-9);
  });

  it('preview speaks with the voice and tuning being edited', () => {
    configureSpeech({ voiceURIByLocale: { 'es-MX': PAULINA.voiceURI } });
    previewVoice('así sueno', 'es-MX', { voiceURI: MONICA.voiceURI, rate: 1.1, pitch: 1.6, volume: 0.9 });
    assert.equal(cancels, 1);
    assert.deepEqual(summary(spoken[0]!), {
      text: 'así sueno',
      lang: 'es-MX',
      voiceURI: MONICA.voiceURI,
      rate: 1.1,
      pitch: 1.6,
      volume: 0.9,
    });
  });

  it('the TTS fallback for recorded media uses the chosen voice and tuning', async () => {
    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    configureSpeech({ voiceURIByLocale: { 'es-MX': MONICA.voiceURI }, pitch: 1.4 });
    const button = {
      kind: 'analytic',
      id: 'b1',
      label: 'agua',
      speechText: 'agua',
      locale: 'es-MX',
      position: { row: 0, column: 0 },
      locked: false,
      audio: { url: '/api/media/rec', recordedBy: 'caregiver' },
    } as unknown as BoardButton;
    await speakButton(button, { closeLabel: 'Cerrar' });
    assert.equal(spoken.length, 1);
    assert.deepEqual(summary(spoken[0]!), {
      text: 'agua',
      lang: 'es-MX',
      voiceURI: MONICA.voiceURI,
      rate: 1,
      pitch: 1.4,
      volume: 1,
    });
  });
});

describe('one speech path', () => {
  it('no other web source builds or speaks an utterance', () => {
    const root = join(import.meta.dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(full);
      }
    };
    walk(root);
    assert.ok(files.length > 50, `expected to scan apps/web/src, listed ${files.length}`);
    const offenders = files
      .map((file) => relative(root, file))
      .filter((file) => file !== join('lib', 'play-button-speech.ts'))
      .filter((file) => /speechSynthesis\.speak\(|new SpeechSynthesisUtterance\(/.test(readFileSync(join(root, file), 'utf8')));
    assert.deepEqual(offenders, []);
  });
});

describe('scan pause while speaking is bounded (C-029)', () => {
  let active = false;
  let unsubscribe: () => void = () => undefined;
  let synth: { speaking?: boolean; pending?: boolean };

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
    synth = (g.window as { speechSynthesis: { speaking?: boolean; pending?: boolean } }).speechSynthesis;
    unsubscribe = subscribeSpeechActivity((value) => {
      active = value;
    });
  });

  afterEach(() => {
    unsubscribe();
    resetSpeechActivityForTests();
    mock.timers.reset();
  });

  it('estimates from length and rate, never under 2 s nor over 15 s', () => {
    assert.equal(estimateUtteranceMs('sí'), SPEECH_PAUSE_MIN_MS);
    assert.equal(estimateUtteranceMs(''), SPEECH_PAUSE_MIN_MS);
    assert.equal(estimateUtteranceMs('a'.repeat(1000)), SPEECH_PAUSE_MAX_MS);
    const sentence = 'yo quiero tomar agua fría por favor';
    const atRate1 = estimateUtteranceMs(sentence, 1);
    assert.ok(atRate1 > SPEECH_PAUSE_MIN_MS && atRate1 < SPEECH_PAUSE_MAX_MS, `got ${atRate1}`);
    assert.ok(estimateUtteranceMs(sentence, 0.5) > atRate1, 'a slower rate holds longer');
    assert.equal(estimateUtteranceMs(sentence, 0), atRate1, 'an invalid rate counts as 1');
    assert.equal(estimateUtteranceMs(sentence, Number.NaN), atRate1);
  });

  it('an engine that never fires end or error releases the pause at the bound', () => {
    speakText('agua', 'es-MX');
    assert.equal(active, true);
    const bound = estimateUtteranceMs('agua');
    mock.timers.tick(bound - 1);
    assert.equal(active, true, 'still held just before the bound');
    mock.timers.tick(1);
    assert.equal(active, false, 'released at the bound');
  });

  it('an engine stuck reporting speaking still releases at the bound', () => {
    synth.speaking = true;
    synth.pending = false;
    const text = 'quiero ir al parque con mi mamá';
    speakText(text, 'es-MX');
    mock.timers.tick(estimateUtteranceMs(text) - 1);
    assert.equal(active, true);
    mock.timers.tick(1);
    assert.equal(active, false);
  });

  it('releases as soon as the engine goes idle without an end event', () => {
    synth.speaking = true;
    synth.pending = false;
    speakText('quiero ir al parque con mi mamá', 'es-MX');
    mock.timers.tick(SPEECH_IDLE_GRACE_MS + SPEECH_IDLE_POLL_MS);
    assert.equal(active, true, 'held while the engine speaks');
    synth.speaking = false;
    mock.timers.tick(SPEECH_IDLE_POLL_MS);
    assert.equal(active, false, 'released on the next idle check');
  });

  it('does not treat the moment right after speak() as idle', () => {
    synth.speaking = false;
    synth.pending = false;
    speakText('agua', 'es-MX');
    mock.timers.tick(SPEECH_IDLE_GRACE_MS - SPEECH_IDLE_POLL_MS);
    assert.equal(active, true);
  });

  it('end and error release at once and leave no timer behind', () => {
    speakText('agua', 'es-MX');
    spoken[0]!.onend?.();
    assert.equal(active, false);
    speakText('leche', 'es-MX');
    assert.equal(active, true);
    spoken[1]!.onerror?.();
    assert.equal(active, false);
    // A late end for the same utterance does not end someone else's speech.
    speakText('pan', 'es-MX');
    spoken[0]!.onend?.();
    assert.equal(active, true);
    mock.timers.tick(SPEECH_PAUSE_MAX_MS);
    assert.equal(active, false);
  });

  it('a queued utterance keeps the pause after the first one ends', () => {
    synth.speaking = true;
    synth.pending = true;
    speakText('yo', 'es-MX');
    speakText('quiero agua', 'es-MX');
    spoken[0]!.onend?.();
    assert.equal(active, true);
    spoken[1]!.onstart?.();
    spoken[1]!.onend?.();
    assert.equal(active, false);
  });

  it('a start after the bound released holds the pause again until end or a new bound', () => {
    speakText('agua', 'es-MX');
    mock.timers.tick(estimateUtteranceMs('agua'));
    assert.equal(active, false);
    spoken[0]!.onstart?.();
    assert.equal(active, true, 'the utterance really started: pause again');
    mock.timers.tick(estimateUtteranceMs('agua'));
    assert.equal(active, false, 'bounded again');
    spoken[0]!.onstart?.();
    spoken[0]!.onend?.();
    assert.equal(active, false);
    spoken[0]!.onstart?.();
    assert.equal(active, false, 'nothing holds the pause after end');
  });
});
