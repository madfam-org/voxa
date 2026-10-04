import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createDemoBoard, createStarterBoard } from '@voxa/core';
import { localAiService } from '@voxa/ai';
import { presentBoardForDisplay } from './board-presentation';
import { composeMessage, speakWholeMessage, speechLocaleForBoard } from './utterance-speech';

interface FakeUtterance {
  text: string;
  lang?: string;
}

const g = globalThis as unknown as Record<string, unknown>;
let spoken: FakeUtterance[] = [];

beforeEach(() => {
  spoken = [];
  g.SpeechSynthesisUtterance = class {
    text: string;
    lang?: string;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  g.window = {
    speechSynthesis: {
      speak: (utterance: FakeUtterance) => spoken.push({ text: utterance.text, lang: utterance.lang }),
      cancel: () => undefined,
    },
  };
});

afterEach(() => {
  delete g.window;
  delete g.SpeechSynthesisUtterance;
});

describe('whole-message speech locale', () => {
  it('speaks an es-MX board in es-MX even when the UI is English', () => {
    const board = createStarterBoard('core-47', { locale: 'es-MX' });
    assert.equal(speakWholeMessage(board, ['yo', 'querer', 'beber'], 'en'), true);
    assert.deepEqual(spoken, [{ text: 'yo quiero beber', lang: 'es-MX' }]);
  });

  it('speaks the es-MX literacy keyboard sentence in es-MX', () => {
    const board = createStarterBoard('literacy-keyboard', { locale: 'es-MX' });
    speakWholeMessage(board, ['HOLA', 'MAMÁ'], 'es');
    assert.deepEqual(spoken, [{ text: 'HOLA MAMÁ', lang: 'es-MX' }]);
  });

  it('speaks the /app demo board in es-MX for a Spanish UI', () => {
    const board = presentBoardForDisplay(createDemoBoard(), {
      boardId: 'demo-core',
      isEditor: false,
      uiLocale: 'es',
    });
    const yo = board.grid.buttons.find((button) => button.id === 'i');
    assert.equal(yo?.kind === 'analytic' ? yo.label : undefined, 'yo');
    speakWholeMessage(board, ['yo', 'querer'], 'es');
    assert.deepEqual(spoken, [{ text: 'yo quiero', lang: 'es-MX' }]);
  });

  it('falls back to the UI content locale for a board with no buttons', () => {
    const empty = { grid: { rows: 1, columns: 1, buttons: [] } };
    assert.equal(speechLocaleForBoard(empty, 'fr'), 'fr-FR');
    assert.equal(speechLocaleForBoard(empty, 'xx'), 'es-MX');
  });

  it('does not speak an empty message', () => {
    assert.equal(speakWholeMessage(createStarterBoard('core-47'), [], 'es'), false);
    assert.deepEqual(spoken, []);
  });
});

describe('composeMessage (Spanish agreement on the message bar)', () => {
  const es = createStarterBoard('core-47', { locale: 'es-MX' });

  it('conjugates the verb after a subject pronoun on an es-MX board', () => {
    assert.deepEqual(composeMessage(es, ['yo', 'querer', 'beber'], 'es'), {
      text: 'yo quiero beber',
      baseText: 'yo querer beber',
      agreementApplied: true,
    });
  });

  it('keeps the base form when the communicator turns agreement off', () => {
    assert.deepEqual(composeMessage(es, ['yo', 'querer', 'beber'], 'es', { agreement: false }), {
      text: 'yo querer beber',
      baseText: 'yo querer beber',
      agreementApplied: false,
    });
    speakWholeMessage(es, ['yo', 'querer', 'beber'], 'es', { agreement: false });
    assert.deepEqual(spoken, [{ text: 'yo querer beber', lang: 'es-MX' }]);
  });

  it('leaves English boards to their own word forms', () => {
    const en = createStarterBoard('core-47', { locale: 'en-US' });
    const composed = composeMessage(en, ['I', 'want', 'drink'], 'es');
    assert.equal(composed.text, 'I want drink');
    assert.equal(composed.agreementApplied, false);
  });

  it('never rewrites what was typed on a keyboard board', () => {
    const keyboard = createStarterBoard('literacy-keyboard', { locale: 'es-MX' });
    const composed = composeMessage(keyboard, ['YO', 'QUERER'], 'es');
    assert.equal(composed.agreementApplied, false);
  });

  it('reports no change when nothing needed agreement', () => {
    const composed = composeMessage(es, ['más', 'agua'], 'es');
    assert.equal(composed.text, 'más agua');
    assert.equal(composed.agreementApplied, false);
  });
});

describe('composeMessage on a tapped suggestion', () => {
  it('agrees a Spanish suggestion the same way as tapped buttons', async () => {
    const es = createStarterBoard('core-47', { locale: 'es-MX' });
    const suggestions = await localAiService.predictText({
      profileId: 'p',
      recentUtterances: [],
      partialText: 'yo querer',
      locale: 'es-MX',
      maxSuggestions: 3,
    });
    const first = suggestions[0]?.text ?? '';
    assert.match(first, /^yo querer \S/);
    const words = first.split(/\s+/);
    const composed = composeMessage(es, words, 'es');
    assert.equal(composed.text, ['yo', 'quiero', ...words.slice(2)].join(' '));
    assert.equal(composed.baseText, first);
  });
});
