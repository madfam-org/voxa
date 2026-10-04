import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { BETA_IMPORT_FORMATS, contentLocaleForUi } from './board-import.js';

const catalogs = ['es', 'en', 'fr'].map((locale) => ({
  locale,
  messages: JSON.parse(readFileSync(new URL(`../../../../packages/i18n/messages/${locale}.json`, import.meta.url), 'utf8')) as {
    communicator: Record<string, string>;
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
