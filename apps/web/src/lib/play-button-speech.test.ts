import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { BoardButton } from '@voxa/core';
import {
  announceScanLabel,
  configureSpeech,
  previewVoice,
  resetSpeechActivityForTests,
  resetSpeechPreferencesForTests,
  resolveSpeechVoice,
  SCAN_CUE_VOLUME_FACTOR,
  speakButton,
  speakText,
} from './play-button-speech';
import type { VoiceLike } from './speech-voices';

interface FakeUtterance {
  text: string;
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
