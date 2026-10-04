import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bestVoiceForLocale,
  chosenVoiceForLocale,
  groupVoicesForLocale,
  hasVoiceForLocale,
  loadVoices,
  normalizeLang,
  normalizeSpeechTuning,
  normalizeVoiceChoices,
  rankVoices,
  resolveVoice,
  voiceLocaleMatch,
  voiceNameHints,
  type VoiceLike,
  type VoiceSource,
} from './speech-voices';

function voice(name: string, lang: string, extra: Partial<VoiceLike> = {}): VoiceLike {
  return { voiceURI: `uri:${name}`, name, lang, localService: true, default: false, ...extra };
}

const ES_ES = voice('Mónica', 'es-ES');
const ES_MX = voice('Paulina', 'es-MX');
const ES_US = voice('Google español de Estados Unidos', 'es-US', { localService: false });
const EN_US = voice('Samantha', 'en-US', { default: true });
const FR_FR = voice('Thomas', 'fr-FR');

describe('normalizeLang and voiceLocaleMatch', () => {
  it('canonicalises tags', () => {
    assert.equal(normalizeLang('es_mx'), 'es-MX');
    assert.equal(normalizeLang('ES-mx'), 'es-MX');
    assert.equal(normalizeLang('es-419'), 'es-419');
    assert.equal(normalizeLang('zh-hant-tw'), 'zh-Hant-TW');
  });

  it('grades the match', () => {
    assert.equal(voiceLocaleMatch('es-MX', 'es-MX'), 'exact');
    assert.equal(voiceLocaleMatch('es_MX', 'es-mx'), 'exact');
    assert.equal(voiceLocaleMatch('es-US', 'es-MX'), 'neighbour');
    assert.equal(voiceLocaleMatch('es-419', 'es-MX'), 'neighbour');
    assert.equal(voiceLocaleMatch('es-ES', 'es-MX'), 'language');
    assert.equal(voiceLocaleMatch('en-US', 'es-MX'), 'none');
  });
});

describe('voiceNameHints', () => {
  it('reads only what the name says', () => {
    assert.deepEqual(voiceNameHints('Paulina (Enhanced)'), ['enhanced']);
    assert.deepEqual(voiceNameHints('Paulina (Premium)'), ['premium']);
    assert.deepEqual(voiceNameHints('Microsoft Dalia Online (Natural) - Spanish (Mexico)'), ['natural', 'online']);
    assert.deepEqual(voiceNameHints('Google español'), ['google']);
    assert.deepEqual(voiceNameHints('Paulina'), []);
  });
});

describe('ranking and selection', () => {
  it('prefers es-MX over es-ES over other languages', () => {
    const ranked = rankVoices([EN_US, ES_ES, FR_FR, ES_MX], 'es-MX').map((r) => r.voice.name);
    assert.deepEqual(ranked.slice(0, 2), ['Paulina', 'Mónica']);
    assert.equal(bestVoiceForLocale([EN_US, ES_ES, FR_FR, ES_MX], 'es-MX'), ES_MX);
    assert.equal(bestVoiceForLocale([EN_US, ES_ES, FR_FR], 'es-MX'), ES_ES);
  });

  it('puts American Spanish variants before es-ES when es-MX is missing', () => {
    assert.equal(bestVoiceForLocale([ES_ES, ES_US, EN_US], 'es-MX'), ES_US);
  });

  it('ranks quality hints within the same locale, and novelty voices last', () => {
    const plain = voice('Paulina', 'es-MX');
    const enhanced = voice('Paulina (Enhanced)', 'es-MX');
    const premium = voice('Paulina (Premium)', 'es-MX');
    const natural = voice('Microsoft Dalia Online (Natural)', 'es-MX', { localService: false });
    assert.deepEqual(
      rankVoices([plain, enhanced, natural, premium], 'es-MX').map((r) => r.voice.name),
      ['Paulina (Premium)', 'Microsoft Dalia Online (Natural)', 'Paulina (Enhanced)', 'Paulina'],
    );
    const bubbles = voice('Bubbles', 'en-US');
    const alex = voice('Alex', 'en-US');
    assert.equal(bestVoiceForLocale([bubbles, alex], 'en-US'), alex);
  });

  it('returns null when the device has no voice for the language', () => {
    assert.equal(bestVoiceForLocale([EN_US, FR_FR], 'es-MX'), null);
    assert.equal(hasVoiceForLocale([EN_US, FR_FR], 'es-MX'), false);
    assert.equal(hasVoiceForLocale([EN_US, ES_ES], 'es-MX'), true);
  });

  it('groups voices for the settings list', () => {
    const groups = groupVoicesForLocale([EN_US, ES_ES, ES_US, ES_MX, FR_FR], 'es-MX');
    assert.deepEqual(groups.exact.map((r) => r.voice.name), ['Paulina']);
    assert.deepEqual(groups.sameLanguage.map((r) => r.voice.name), ['Google español de Estados Unidos', 'Mónica']);
    assert.deepEqual(groups.other.map((r) => r.voice.name).sort(), ['Samantha', 'Thomas']);
  });
});

describe('resolveVoice', () => {
  const voices = [EN_US, ES_ES, ES_MX];

  it('uses the stored choice while the device has it', () => {
    assert.deepEqual(resolveVoice(voices, 'es-MX', ES_ES.voiceURI), {
      voice: ES_ES,
      source: 'chosen',
      chosenMissing: false,
    });
  });

  it('keeps an explicit choice from "show all" even in another language', () => {
    assert.equal(resolveVoice(voices, 'es-MX', EN_US.voiceURI).voice, EN_US);
  });

  it('falls back to the best match and flags the notice when the stored voice is gone', () => {
    assert.deepEqual(resolveVoice(voices, 'es-MX', 'uri:gone-after-os-update'), {
      voice: ES_MX,
      source: 'best',
      chosenMissing: true,
    });
  });

  it('does not flag a missing voice while the list is still empty (not loaded)', () => {
    assert.deepEqual(resolveVoice([], 'es-MX', ES_MX.voiceURI), { voice: null, source: 'none', chosenMissing: false });
  });

  it('with no voice for the language, lets the browser choose from lang', () => {
    assert.deepEqual(resolveVoice([EN_US], 'es-MX'), { voice: null, source: 'none', chosenMissing: false });
  });
});

describe('stored settings', () => {
  it('finds the choice by exact locale, then by language', () => {
    assert.equal(chosenVoiceForLocale({ 'es-MX': 'a', 'en-US': 'b' }, 'es-MX'), 'a');
    assert.equal(chosenVoiceForLocale({ 'es-MX': 'a' }, 'es-US'), 'a');
    assert.equal(chosenVoiceForLocale({ 'es-MX': 'a' }, 'en-US'), undefined);
  });

  it('normalises stored voice choices and tuning', () => {
    assert.deepEqual(normalizeVoiceChoices({ es_mx: 'a', 'en-US': 7, '': 'x' }), { 'es-MX': 'a' });
    assert.deepEqual(normalizeVoiceChoices(['a']), {});
    assert.deepEqual(normalizeSpeechTuning({ rate: 9, pitch: 'x', volume: -1 }), { rate: 2, pitch: 1, volume: 0 });
    assert.deepEqual(normalizeSpeechTuning(undefined), { rate: 1, pitch: 1, volume: 1 });
  });
});

describe('loadVoices', () => {
  it('resolves at once when the list is already there', async () => {
    const source: VoiceSource = { getVoices: () => [ES_MX] };
    assert.deepEqual(await loadVoices(source, { timeoutMs: 50 }), [ES_MX]);
  });

  it('resolves on voiceschanged', async () => {
    let list: VoiceLike[] = [];
    let listener: (() => void) | undefined;
    const source: VoiceSource = {
      getVoices: () => list,
      addEventListener: (_type, fn) => {
        listener = fn;
      },
      removeEventListener: () => {
        listener = undefined;
      },
    };
    const pending = loadVoices(source, { retryIntervalMs: 1000, timeoutMs: 5000 });
    list = [ES_MX, EN_US];
    listener?.();
    assert.deepEqual(await pending, [ES_MX, EN_US]);
    assert.equal(listener, undefined, 'listener removed after resolving');
  });

  it('still resolves when voiceschanged never fires (bounded retry finds the list)', async () => {
    let calls = 0;
    const source: VoiceSource = { getVoices: () => (++calls >= 3 ? [ES_MX] : []) };
    assert.deepEqual(await loadVoices(source, { retryIntervalMs: 5, timeoutMs: 1000 }), [ES_MX]);
  });

  it('still resolves (empty) when the browser never has voices', async () => {
    const started = Date.now();
    const source: VoiceSource = { getVoices: () => [] };
    assert.deepEqual(await loadVoices(source, { retryIntervalMs: 5, timeoutMs: 40 }), []);
    assert.ok(Date.now() - started < 1000);
  });

  it('survives a getVoices that throws', async () => {
    const source: VoiceSource = {
      getVoices: () => {
        throw new Error('not allowed');
      },
    };
    assert.deepEqual(await loadVoices(source, { retryIntervalMs: 5, timeoutMs: 20 }), []);
  });
});
