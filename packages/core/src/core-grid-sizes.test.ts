import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CORE_SYMBOL_ALLOW_MAP, mulberrySymbolUrl } from './core-symbols.js';
import {
  CORE_GRID_SIZES,
  CORE_ORDER_BY_LOCALE,
  CORE_VOCABULARY_REVIEW,
  coreGrowthOrder,
  DEFAULT_CORE_GRID_TEMPLATE,
} from './core-grid-sizes.js';
import { coreWord } from './core-word-bank.js';
import { STARTER_CONTENT_LOCALES } from './demo-locale.js';
import type { Board, BoardButton } from './index.js';
import { createStarterBoard, isStarterTemplateId, listStarterTemplates } from './starter-boards.js';

function label(button: BoardButton): string {
  return button.kind === 'analytic' ? button.label : '';
}

function positions(board: Board): Map<string, string> {
  return new Map(board.grid.buttons.map((b) => [String(b.id), `${b.position.row},${b.position.column}`]));
}

describe('core grid sizes: one ordered list, nested sizes', () => {
  it('offers at least three sizes, ascending, each nested in the next (same origin)', () => {
    assert.ok(CORE_GRID_SIZES.length >= 3);
    assert.deepEqual(
      CORE_GRID_SIZES.map((s) => [s.templateId, s.rows, s.columns, s.cells]),
      [
        ['core-24', 4, 6, 24],
        ['core-36', 6, 6, 36],
        ['core-60', 6, 10, 60],
      ],
    );
    for (let i = 1; i < CORE_GRID_SIZES.length; i += 1) {
      const small = CORE_GRID_SIZES[i - 1]!;
      const large = CORE_GRID_SIZES[i]!;
      assert.ok(large.rows >= small.rows && large.columns >= small.columns, `${small.templateId} ⊄ ${large.templateId}`);
      assert.ok(large.cells > small.cells);
      assert.equal(small.cells, small.rows * small.columns);
    }
    assert.equal(DEFAULT_CORE_GRID_TEMPLATE, 'core-36');
  });

  it('the growth order lists every cell once and each size block is a prefix of it', () => {
    const order = coreGrowthOrder();
    const largest = CORE_GRID_SIZES[CORE_GRID_SIZES.length - 1]!;
    assert.equal(order.length, largest.cells);
    assert.equal(new Set(order.map((c) => `${c.row},${c.column}`)).size, order.length);
    for (const size of CORE_GRID_SIZES) {
      const prefix = order.slice(0, size.cells);
      assert.ok(
        prefix.every((c) => c.row < size.rows && c.column < size.columns),
        `the first ${size.cells} growth cells must fill the ${size.rows}×${size.columns} block`,
      );
    }
  });

  for (const locale of STARTER_CONTENT_LOCALES) {
    describe(locale, () => {
      const boards = CORE_GRID_SIZES.map((size) => ({ size, board: createStarterBoard(size.templateId, { locale }) }));

      it('has one ordered core list of known words, long enough for the largest size, without duplicates', () => {
        const order = CORE_ORDER_BY_LOCALE[locale];
        assert.ok(order.length >= CORE_GRID_SIZES[CORE_GRID_SIZES.length - 1]!.cells);
        assert.equal(new Set(order).size, order.length);
        for (const slug of order) assert.ok(coreWord(slug), `${slug} is not in the word bank`);
      });

      for (const { size, board } of boards) {
        it(`${size.templateId}: ${size.cells} cells filled once, ${size.rows}×${size.columns}, no duplicate ids or labels`, () => {
          assert.equal(board.grid.rows, size.rows);
          assert.equal(board.grid.columns, size.columns);
          assert.equal(board.grid.buttons.length, size.cells);
          const ids = board.grid.buttons.map((b) => String(b.id));
          assert.equal(new Set(ids).size, ids.length, 'duplicate button id');
          const cells = board.grid.buttons.map((b) => `${b.position.row},${b.position.column}`);
          assert.equal(new Set(cells).size, cells.length, 'two buttons in one cell');
          for (const b of board.grid.buttons) {
            assert.ok(b.position.row >= 0 && b.position.row < size.rows);
            assert.ok(b.position.column >= 0 && b.position.column < size.columns);
          }
          const labels = board.grid.buttons.map(label);
          assert.equal(new Set(labels).size, labels.length, `duplicate label in ${locale}: ${labels.join(', ')}`);
        });

        it(`${size.templateId}: every button speaks ${locale}, keeps its Fitzgerald part of speech and lock`, () => {
          for (const b of board.grid.buttons) {
            assert.equal(b.locale, locale);
            assert.equal(b.kind, 'analytic');
            const word = coreWord(String(b.id));
            assert.ok(word, `${String(b.id)} not in the word bank`);
            assert.equal(b.partOfSpeech, word.pos);
            assert.equal(b.locked, word.locked ?? false);
          }
        });

        it(`${size.templateId}: each symbol comes from the allow-map, else the cell is label-only`, () => {
          for (const b of board.grid.buttons) {
            const slug = String(b.id);
            const entry = CORE_SYMBOL_ALLOW_MAP[slug];
            if (entry?.provider === 'mulberry') {
              assert.equal(b.symbolUrl, mulberrySymbolUrl(entry.file), `${slug} symbol url`);
              assert.deepEqual(b.symbolRef, { provider: 'mulberry', slug: entry.file });
            } else {
              assert.equal(b.symbolUrl, undefined, `${slug} must be label-only`);
              assert.equal(b.symbolRef, undefined, `${slug} must be label-only`);
            }
          }
        });
      }

      it('every word of a smaller size sits at the same row and column, with the same label, in every larger size', () => {
        for (let i = 0; i < boards.length; i += 1) {
          for (let j = i + 1; j < boards.length; j += 1) {
            const small = boards[i]!.board;
            const large = boards[j]!.board;
            const largeAt = positions(large);
            const largeLabel = new Map(large.grid.buttons.map((b) => [String(b.id), label(b)]));
            for (const b of small.grid.buttons) {
              const id = String(b.id);
              assert.equal(largeAt.get(id), `${b.position.row},${b.position.column}`, `${id} moved from ${boards[i]!.size.templateId} to ${boards[j]!.size.templateId}`);
              assert.equal(largeLabel.get(id), label(b));
            }
            // The smaller board is exactly the part of the larger one inside its block.
            const inBlock = large.grid.buttons.filter(
              (b) => b.position.row < small.grid.rows && b.position.column < small.grid.columns,
            );
            assert.deepEqual(inBlock.map((b) => String(b.id)).sort(), small.grid.buttons.map((b) => String(b.id)).sort());
          }
        }
      });

      it('every motor-plan locked word is already in the smallest size', () => {
        const smallest = boards[0]!.board;
        const largest = boards[boards.length - 1]!.board;
        const smallIds = new Set(smallest.grid.buttons.map((b) => String(b.id)));
        for (const b of largest.grid.buttons) {
          if (b.locked) assert.ok(smallIds.has(String(b.id)), `${String(b.id)} is locked but not in the smallest size`);
        }
      });
    });
  }

  it('the same word keeps its cell across es-MX, en-US and fr-FR (one motor plan for bilingual users)', () => {
    for (const size of CORE_GRID_SIZES) {
      const [es, en, fr] = STARTER_CONTENT_LOCALES.map((locale) =>
        positions(createStarterBoard(size.templateId, { locale })),
      );
      assert.deepEqual([...es!.entries()].sort(), [...en!.entries()].sort());
      assert.deepEqual([...fr!.entries()].sort(), [...en!.entries()].sort());
    }
  });

  it('es-MX labels come from the Spanish table (spot check of the 4×6 block corners)', () => {
    const board = createStarterBoard('core-24', { locale: 'es-MX' });
    const at = (row: number, column: number) =>
      label(board.grid.buttons.find((b) => b.position.row === row && b.position.column === column)!);
    assert.equal(at(0, 0), 'yo');
    assert.equal(at(0, 1), 'querer');
    assert.equal(at(0, 5), 'sí');
    assert.equal(at(3, 0), 'mi');
    assert.equal(at(3, 5), 'terminé');
  });

  it('template metadata marks every core vocabulary as pending clinical review and names the motor-plan family', () => {
    assert.equal(CORE_VOCABULARY_REVIEW, 'pending-clinical-review');
    const templates = listStarterTemplates();
    for (const size of CORE_GRID_SIZES) {
      const meta = templates.find((t) => t.id === size.templateId);
      assert.ok(meta, `${size.templateId} missing from listStarterTemplates()`);
      assert.equal(meta.vocabularyReview, 'pending-clinical-review');
      assert.equal(meta.motorPlanFamily, 'core-sizes');
      assert.equal(meta.rows * meta.columns, size.cells);
      assert.equal(meta.wordCount, size.cells);
    }
    for (const id of ['core-47', 'core-100']) {
      assert.equal(templates.find((t) => t.id === id)?.vocabularyReview, 'pending-clinical-review');
    }
  });

  it('isStarterTemplateId accepts the listed templates only', () => {
    for (const meta of listStarterTemplates()) assert.ok(isStarterTemplateId(meta.id), meta.id);
    for (const bad of ['core-84', '', 'CORE-24', undefined, 24, '__proto__']) {
      assert.equal(isStarterTemplateId(bad), false, String(bad));
    }
  });
});
