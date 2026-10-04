import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  guessPartOfSpeechFromLabel,
  partOfSpeechFromBorderColor,
  resolvePartOfSpeech,
} from './part-of-speech.js';
import { fitzgeraldColor } from './index.js';

describe('part-of-speech inference', () => {
  it('maps Fitzgerald border colors to POS tags', () => {
    assert.equal(partOfSpeechFromBorderColor('#16a34a'), 'verb');
    assert.equal(partOfSpeechFromBorderColor('2563eb'), 'adjective');
  });

  it('guesses POS from common AAC labels', () => {
    assert.equal(guessPartOfSpeechFromLabel('I'), 'pronoun');
    assert.equal(guessPartOfSpeechFromLabel('want'), 'verb');
    assert.equal(guessPartOfSpeechFromLabel('home'), 'noun');
    assert.equal(guessPartOfSpeechFromLabel('please'), 'social');
    assert.equal(guessPartOfSpeechFromLabel('yes'), 'social');
  });

  it('colors social words with the Fitzgerald pink and keeps pink borders importing as preposition', () => {
    assert.equal(fitzgeraldColor('social'), '#db2777');
    assert.equal(resolvePartOfSpeech({ kind: 'analytic', label: 'thanks' }), 'social');
    assert.equal(partOfSpeechFromBorderColor('#db2777'), 'preposition');
  });

  it('resolves POS from explicit tag, color, then label', () => {
    assert.equal(
      resolvePartOfSpeech({ kind: 'analytic', label: 'unknown', partOfSpeech: 'verb' }),
      'verb',
    );
    assert.equal(
      resolvePartOfSpeech({ kind: 'analytic', label: 'xyz' }, '#ea580c'),
      'noun',
    );
    assert.equal(resolvePartOfSpeech({ kind: 'analytic', label: 'go' }), 'verb');
    assert.equal(resolvePartOfSpeech({ kind: 'glp', phrase: 'Yay!' }), 'preposition');
  });
});
