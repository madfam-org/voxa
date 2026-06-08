import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  guessPartOfSpeechFromLabel,
  partOfSpeechFromBorderColor,
  resolvePartOfSpeech,
} from './part-of-speech.js';

describe('part-of-speech inference', () => {
  it('maps Fitzgerald border colors to POS tags', () => {
    assert.equal(partOfSpeechFromBorderColor('#16a34a'), 'verb');
    assert.equal(partOfSpeechFromBorderColor('2563eb'), 'adjective');
  });

  it('guesses POS from common AAC labels', () => {
    assert.equal(guessPartOfSpeechFromLabel('I'), 'pronoun');
    assert.equal(guessPartOfSpeechFromLabel('want'), 'verb');
    assert.equal(guessPartOfSpeechFromLabel('home'), 'noun');
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
