import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveButtonSpeech, type BoardButton } from '@voxa/core';
import { mergeSpeechForms, suggestInflections } from './inflections.js';

describe('inflections', () => {
  it('suggests verb forms for core words', () => {
    const forms = suggestInflections('go', 'verb');
    assert.ok(forms.some((form) => form.speechText === 'went'));
  });

  it('merges without duplicates', () => {
    const merged = mergeSpeechForms(
      [{ id: 'go-past', label: 'went', speechText: 'went' }],
      [{ id: 'go-past', label: 'went', speechText: 'went' }, { id: 'go-third', label: 'goes', speechText: 'goes' }],
    );
    assert.equal(merged.length, 2);
  });
});

describe('resolveButtonSpeech', () => {
  it('uses active speech form when set', () => {
    const btn = {
      kind: 'analytic',
      id: 'go',
      label: 'go',
      speechText: 'go',
      speechForms: [
        { id: 'go-past', label: 'went', speechText: 'went' },
        { id: 'go-third', label: 'goes', speechText: 'goes' },
      ],
      activeSpeechFormId: 'go-past',
      locale: 'en-US',
      position: { row: 0, column: 0 },
      locked: false,
    } as BoardButton;

    assert.equal(resolveButtonSpeech(btn), 'went');
    assert.equal(resolveButtonSpeech(btn, 1), 'goes');
  });
});
