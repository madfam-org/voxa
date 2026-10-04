import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createTranslator } from 'next-intl';
import { VoxaSyncError } from '@voxa/sync';
import { BETA_IMPORT_FORMATS, classifyImportFailure, contentLocaleForUi } from './board-import.js';

const catalogs = ['es', 'en', 'fr'].map((locale) => ({
  locale,
  messages: JSON.parse(readFileSync(new URL(`../../../../packages/i18n/messages/${locale}.json`, import.meta.url), 'utf8')) as {
    communicator: Record<string, string>;
    sync: Record<string, string>;
    demo: { gates: { templates: { body: string } } };
  },
}));

describe('board import UI', () => {
  it('marks Grid 3, Snap and TouchChat as beta and OBF/OBZ as full imports', () => {
    assert.deepEqual([...BETA_IMPORT_FORMATS].sort(), ['gridset', 'snap', 'touchchat']);
  });

  it('sends the content locale of the UI language, Spanish by default', () => {
    assert.equal(contentLocaleForUi('es'), 'es-MX');
    assert.equal(contentLocaleForUi('en'), 'en-US');
    assert.equal(contentLocaleForUi('fr'), 'fr-FR');
    assert.equal(contentLocaleForUi('pt'), 'es-MX');
  });

  it('every catalog labels the one-page imports as beta, in the buttons and in the public feature copy', () => {
    for (const { locale, messages } of catalogs) {
      const c = messages.communicator;
      for (const key of ['importGrid', 'importSnap', 'importTouchChat']) {
        assert.match(c[key] ?? '', /b[eê]ta/i, `${locale} communicator.${key}`);
      }
      assert.match(c.importBetaNotice ?? '', /b[eê]ta/i, `${locale} importBetaNotice`);
      assert.ok(c.importConfirm && c.importConfirmAction && c.importSkippedMedia, `${locale} import strings`);
      assert.match(messages.demo.gates.templates.body, /b[eê]ta/i, `${locale} public feature copy`);
    }
  });
});

describe('import over the plan board limit (402)', () => {
  it('is classified as a board-limit failure with the plan limit, never as a generic error', () => {
    const limited = new VoxaSyncError('Board limit reached for your plan', 402, {
      error: 'Board limit reached for your plan',
      code: 'BOARD_LIMIT',
      tier: 'free',
      limit: 1,
    });
    assert.deepEqual(classifyImportFailure(limited), { kind: 'board-limit', limit: 1 });
    assert.deepEqual(classifyImportFailure(new VoxaSyncError('x', 402)), { kind: 'board-limit' });
    assert.deepEqual(classifyImportFailure(new VoxaSyncError('Invalid OBF document', 400)), {
      kind: 'error',
      message: 'Invalid OBF document',
    });
    assert.equal(classifyImportFailure(new Error('network')).kind, 'error');
  });

  it('every catalog says how many boards the plan allows and offers export and delete, unlike the generic and offline messages', () => {
    const counts: Record<string, [RegExp, RegExp]> = {
      es: [/permite 1 tablero /, /permite 10 tableros /],
      en: [/allows 1 board /, /allows 10 boards /],
      fr: [/permet 1 tableau /, /permet 10 tableaux /],
    };
    for (const { locale, messages } of catalogs) {
      const t = createTranslator({ locale, messages, namespace: 'communicator' });
      const one = t('importBoardLimit', { limit: 1 });
      const ten = t('importBoardLimit', { limit: 10 });
      assert.match(one, counts[locale]![0]!, `${locale}: ${one}`);
      assert.match(ten, counts[locale]![1]!, `${locale}: ${ten}`);
      const help = t('importBoardLimitHelp');
      assert.match(help, /OBF/);
      assert.match(help, /OBZ/);
      assert.ok(t('importBoardLimitDelete') && t('importBoardLimitClose') && t('importBoardLimitUnknown'));
      const generic = t('actionFailed', { detail: 'Board limit reached for your plan' });
      assert.notEqual(one, generic);
      for (const offline of Object.values(messages.sync)) assert.notEqual(one, offline);
    }
  });
});
