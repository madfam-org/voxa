import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createButtonId } from '@voxa/core';
import { buildSymbolPredictions, buildTextPredictions } from './predict.js';

describe('AI predictions', () => {
  it('suggests continuations after "I"', () => {
    const preds = buildTextPredictions('I', 3);
    assert.ok(preds.some((p) => p.text.toLowerCase().includes('want')));
  });

  it('suggests symbols after selecting "want"', () => {
    const wantId = createButtonId('want');
    const more = {
      kind: 'analytic' as const,
      id: createButtonId('more'),
      label: 'more',
      speechText: 'more',
      locale: 'en-US',
      position: { row: 0, column: 3 },
      locked: true,
    };
    const want = {
      kind: 'analytic' as const,
      id: wantId,
      label: 'want',
      speechText: 'want',
      locale: 'en-US',
      position: { row: 0, column: 1 },
      locked: true,
    };

    const symbols = buildSymbolPredictions([wantId as string], [want, more], 3);
    assert.ok(symbols.some((s) => s.label === 'more'));
  });
});
