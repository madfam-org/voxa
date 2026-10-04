import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createDemoBoard, createStarterBoard } from '@voxa/core';
import { presentBoardForDisplay } from './board-presentation';
import { speakWholeMessage, speechLocaleForBoard } from './utterance-speech';

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
    assert.deepEqual(spoken, [{ text: 'yo querer beber', lang: 'es-MX' }]);
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
    assert.deepEqual(spoken, [{ text: 'yo querer', lang: 'es-MX' }]);
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
