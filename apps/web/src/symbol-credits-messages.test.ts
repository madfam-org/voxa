import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const messagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/i18n/messages');

interface Section {
  title: string;
  content: string;
  links?: { label: string; href: string }[];
}

function load(locale: string): Record<string, any> {
  return JSON.parse(readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8'));
}

const UNAVAILABLE: Record<string, string> = {
  es: 'Símbolo no disponible: elige uno nuevo',
  en: 'Symbol unavailable: choose a new one',
  fr: 'Symbole indisponible : choisissez-en un nouveau',
};

describe('symbol credits and notices (es/en/fr)', () => {
  for (const locale of ['es', 'en', 'fr']) {
    it(`${locale}: /legal/symbols names Mulberry Symbols, Steve Lee and CC BY-SA 4.0 with links`, () => {
      const messages = load(locale);
      const page = messages.legal.symbols as { title: string; sections: Section[] };
      const text = JSON.stringify(page);
      assert.match(text, /Mulberry Symbols/);
      assert.match(text, /Steve Lee/);
      assert.match(text, /CC BY-SA 4\.0/);
      const hrefs = page.sections.flatMap((section) => section.links ?? []).map((link) => link.href);
      assert.ok(hrefs.includes('https://mulberrysymbols.org'));
      assert.ok(hrefs.some((href) => href.startsWith('https://creativecommons.org/licenses/by-sa/4.0/')));
      assert.equal(text.toLowerCase().includes('arasaac'), false);
      assert.ok(messages.nav.symbolCredits);
    });

    it(`${locale}: no message advertises the removed non-commercial symbol library (R86)`, () => {
      const raw = readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8').toLowerCase();
      assert.equal(raw.includes('arasaac'), false);
      assert.match(load(locale).demo.readyBody, /Mulberry/);
    });

    it(`${locale}: editor notice for unavailable symbols and credit line`, () => {
      const messages = load(locale);
      assert.equal(messages.symbols.unavailable, UNAVAILABLE[locale]);
      assert.match(messages.symbols.credit, /<symbols>Mulberry Symbols<\/symbols> © Steve Lee, <license>CC BY-SA 4\.0<\/license>/);
      assert.match(messages.symbols.credit, /<credits>.+<\/credits>/);
    });
  }
});
