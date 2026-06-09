import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createLiteracyKeyboardBoard } from './literacy-keyboard.js';
import {
  applyKeyboardActivation,
  formatKeyboardUtterance,
  insertKeyboardChar,
  insertKeyboardSpace,
  isLiteracyKeyboardBoard,
  keyboardBackspace,
} from './keyboard-input.js';

describe('keyboard input', () => {
  it('builds typed words character by character', () => {
    let words: string[] = [];
    words = insertKeyboardChar(words, 'h');
    words = insertKeyboardChar(words, 'i');
    assert.equal(formatKeyboardUtterance(words), 'hi');
    words = insertKeyboardSpace(words);
    words = insertKeyboardChar(words, 't');
    words = insertKeyboardChar(words, 'o');
    assert.equal(formatKeyboardUtterance(words), 'hi to');
  });

  it('backspaces within and across words', () => {
    let words = ['hello', 'wo'];
    words = keyboardBackspace(words);
    assert.equal(formatKeyboardUtterance(words), 'hello w');
    words = keyboardBackspace(words);
    assert.equal(formatKeyboardUtterance(words), 'hello');
  });

  it('marks literacy keyboard boards', () => {
    const board = createLiteracyKeyboardBoard();
    assert.equal(isLiteracyKeyboardBoard(board), true);
    assert.equal(board.grid.buttons.length, 37);
  });

  it('maps keyboard buttons to edit actions', () => {
    const board = createLiteracyKeyboardBoard();
    const hKey = board.grid.buttons.find((button) => button.kind === 'analytic' && button.label === 'H');
    assert.ok(hKey);
    const typed = applyKeyboardActivation([], hKey!);
    assert.equal(formatKeyboardUtterance(typed.utterance), 'H');
    assert.equal(typed.action, 'edit');
  });
});
