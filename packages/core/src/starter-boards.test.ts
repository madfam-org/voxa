import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createStarterBoard, listStarterTemplates } from './starter-boards.js';

describe('starter board templates', () => {
  it('lists core-47 and core-100 templates', () => {
    const templates = listStarterTemplates();
    assert.equal(templates.length, 4);
    assert.equal(templates[0]?.id, 'core-47');
    assert.equal(templates[2]?.id, 'literacy-keyboard');
    assert.equal(templates[3]?.id, 'visual-schedule');
  });

  it('builds a 6x8 core-47 board with locked motor-plan slots', () => {
    const board = createStarterBoard('core-47');
    assert.equal(board.grid.rows, 6);
    assert.equal(board.grid.columns, 8);
    assert.equal(board.grid.buttons.length, 47);
    assert.ok(
      board.grid.buttons.some(
        (button) => button.locked && button.kind === 'analytic' && button.label === 'want',
      ),
    );
  });

  it('builds a 10x10 core-100 board', () => {
    const board = createStarterBoard('core-100', { boardId: 'my-core-100', name: 'Therapy core' });
    assert.equal(board.id, 'my-core-100');
    assert.equal(board.name, 'Therapy core');
    assert.equal(board.grid.buttons.length, 100);
  });

  it('builds a literacy keyboard template', () => {
    const board = createStarterBoard('literacy-keyboard', { name: 'Typing page' });
    assert.equal(board.layout, 'literacy-keyboard');
    assert.equal(board.name, 'Typing page');
    assert.equal(board.grid.rows, 4);
    assert.ok(board.grid.buttons.some((button) => button.kind === 'analytic' && button.label === 'Space'));
  });

  it('builds a visual schedule template', () => {
    const board = createStarterBoard('visual-schedule', { name: 'School day' });
    assert.equal(board.layout, 'visual-schedule');
    assert.equal(board.name, 'School day');
    assert.equal(board.grid.columns, 1);
    assert.ok(
      board.grid.buttons.some(
        (button) => button.kind === 'analytic' && button.label === 'Brush teeth',
      ),
    );
  });
});

describe('starter boards per content locale', () => {
  it('builds Core 47 for es-MX with es-MX on all 47 buttons and Spanish labels', () => {
    const board = createStarterBoard('core-47', { locale: 'es-MX' });
    assert.equal(board.grid.buttons.length, 47);
    assert.ok(board.grid.buttons.every((button) => button.locale === 'es-MX'));
    const labels = board.grid.buttons.map((button) => (button.kind === 'analytic' ? button.label : ''));
    for (const word of ['yo', 'querer', 'más', 'ayuda', 'comer', 'casa', 'escuela']) {
      assert.ok(labels.includes(word), `missing ${word}`);
    }
    for (const english of ['I', 'want', 'help', 'home', 'school']) {
      assert.ok(!labels.includes(english), `still English: ${english}`);
    }
    const want = board.grid.buttons.find((button) => button.id === 'want');
    assert.equal(want?.kind === 'analytic' ? want.speechText : undefined, 'querer');
  });

  it('builds Core 100 for es-MX and fr-FR with every word translated', () => {
    const en = createStarterBoard('core-100');
    for (const locale of ['es-MX', 'fr-FR'] as const) {
      const board = createStarterBoard('core-100', { locale });
      assert.equal(board.grid.buttons.length, 100);
      assert.ok(board.grid.buttons.every((button) => button.locale === locale));
      const untranslated = board.grid.buttons.filter((button, index) => {
        const source = en.grid.buttons[index];
        return (
          button.kind === 'analytic' &&
          source?.kind === 'analytic' &&
          button.label === source.label &&
          !['no', 'stop'].includes(button.label)
        );
      });
      assert.deepEqual(untranslated.map((button) => String(button.id)), [], locale);
    }
  });

  it('builds an es-MX literacy keyboard with ñ, accented vowels and Spanish command keys', () => {
    const board = createStarterBoard('literacy-keyboard', { locale: 'es-MX' });
    const labels = board.grid.buttons.map((button) => (button.kind === 'analytic' ? button.label : ''));
    const typed = board.grid.buttons.map((button) => (button.kind === 'analytic' ? button.speechText : ''));
    assert.ok(labels.includes('Ñ') && typed.some((text) => text.toLowerCase() === 'ñ'), 'ñ key');
    for (const vowel of ['Á', 'É', 'Í', 'Ó', 'Ú']) assert.ok(labels.includes(vowel), vowel);
    assert.ok(labels.includes('Espacio') && labels.includes('Hablar') && labels.includes('Borrar'));
    assert.ok(board.grid.buttons.every((button) => button.locale === 'es-MX'));
    assert.equal(board.grid.rows, 5);
    const cells = new Set(board.grid.buttons.map((b) => `${b.position.row}:${b.position.column}`));
    assert.equal(cells.size, board.grid.buttons.length, 'no two keys share a cell');
  });

  it('builds the visual schedule in Spanish for es-MX', () => {
    const board = createStarterBoard('visual-schedule', { locale: 'es-MX' });
    const labels = board.grid.buttons.map((button) => (button.kind === 'analytic' ? button.label : ''));
    assert.ok(labels.includes('cepillar dientes'));
    assert.ok(board.grid.buttons.every((button) => button.locale === 'es-MX'));
  });

  it('tags social words (yes, no, please, thank you, sorry) as social, not preposition', () => {
    const board = createStarterBoard('core-47');
    for (const slug of ['yes', 'no', 'please', 'thank-you', 'sorry']) {
      const button = board.grid.buttons.find((b) => b.id === slug);
      assert.equal(button?.partOfSpeech, 'social', slug);
    }
  });
});
