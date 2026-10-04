import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createButtonId } from '@voxa/core';
import { buildSymbolPredictions, buildTextPredictions, predictionLanguage } from './predict.js';
import { localAiService } from './index.js';

describe('AI predictions', () => {
  it('suggests continuations after "I"', () => {
    const preds = buildTextPredictions('I', 3);
    assert.ok(preds.some((p) => p.text.toLowerCase().includes('want')));
  });

  it('appends the continuation to the whole message instead of replacing the last word', () => {
    const preds = buildTextPredictions('I want', 3, 'en-US');
    assert.equal(preds[0]?.text, 'I want more');
    assert.ok(preds.every((p) => p.text.startsWith('I want ')));
  });

  it('suggests Spanish continuations on a Spanish board, never English words', () => {
    const preds = buildTextPredictions('yo', 4, 'es-MX');
    assert.deepEqual(
      preds.map((p) => p.text),
      ['yo quiero', 'yo necesito', 'yo voy', 'yo tengo'],
    );
    const english = /\b(please|now|want|more|help)\b/i;
    for (const partial of ['yo', 'quiero', 'Más', 'tengo', 'una palabra']) {
      for (const p of buildTextPredictions(partial, 5, 'es-MX')) {
        assert.doesNotMatch(p.text, english, `${partial} -> ${p.text}`);
      }
    }
  });

  it('matches Spanish words without their accents and offers Spanish endings', () => {
    const preds = buildTextPredictions('quiero mas', 5, 'es-MX');
    assert.deepEqual(
      preds.map((p) => p.text),
      ['quiero mas por favor', 'quiero mas comida', 'quiero mas jugar', 'quiero mas ahora'],
    );
    const endings = buildTextPredictions('agua', 3, 'es');
    assert.deepEqual(
      endings.map((p) => p.text),
      ['agua por favor', 'agua ahora'],
    );
  });

  it('does not repeat an ending the message already has', () => {
    const preds = buildTextPredictions('ayuda por favor', 3, 'es-MX');
    assert.ok(preds.every((p) => !p.text.endsWith('por favor por favor')));
  });

  it('selects the table by board locale and offers nothing for a language without one', () => {
    assert.equal(predictionLanguage('es-MX'), 'es');
    assert.equal(predictionLanguage('ES_us'), 'es');
    assert.equal(predictionLanguage('en-US'), 'en');
    assert.equal(predictionLanguage(undefined), 'en');
    assert.equal(predictionLanguage('fr-FR'), null);
    assert.deepEqual(buildTextPredictions('je veux', 3, 'fr-FR'), []);
  });

  it('localAiService passes the request locale through', async () => {
    const preds = await localAiService.predictText({
      profileId: 'p1',
      recentUtterances: [],
      partialText: 'yo',
      locale: 'es-MX',
      maxSuggestions: 2,
    });
    assert.deepEqual(
      preds.map((p) => p.text),
      ['yo quiero', 'yo necesito'],
    );
  });

  it('suggests Spanish symbols after "querer" on a Spanish board', () => {
    const button = (slug: string, label: string, column: number) => ({
      kind: 'analytic' as const,
      id: createButtonId(slug),
      label,
      speechText: label,
      locale: 'es-MX',
      position: { row: 0, column },
      locked: true,
    });
    const querer = button('want', 'querer', 0);
    const buttons = [querer, button('more', 'más', 1), button('eat', 'comer', 2), button('stop', 'parar', 3)];
    const symbols = buildSymbolPredictions([querer.id as string], buttons, 3);
    assert.deepEqual(
      symbols.map((s) => s.label),
      ['más', 'comer'],
    );
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
