import { createButtonId, type BoardButton, type GridPosition } from './index.js';
import { coreSymbolFields } from './core-symbols.js';
import { coreWord } from './core-word-bank.js';
import type { StarterContentLocale } from './demo-locale.js';

/**
 * Core boards in several grid sizes with one stable motor plan.
 *
 * Rule (tested in `core-grid-sizes.test.ts`): the sizes are nested. Each
 * size's grid is the top-left block of every larger size (4×6 ⊂ 6×6 ⊂ 6×10),
 * so a larger grid only adds rows below and columns to the right. The cells
 * are filled from ONE ordered core list per locale along a fixed growth
 * order: first the 24 cells of the 4×6 block (row by row), then the 12 cells
 * the 6×6 grid adds (rows 4–5), then the 24 cells the 6×10 grid adds
 * (columns 6–9). A size uses the first N words of the list on the first N
 * cells of the growth order. Consequences:
 *
 * - a smaller board is exactly the subset of a larger one that falls in its
 *   block, word for word and cell for cell;
 * - moving to a larger size never moves a word the user already learned:
 *   every word keeps the same row and column;
 * - the three locales share the same order today, so a word also keeps its
 *   place across es-MX, en-US and fr-FR (a bilingual user keeps one motor
 *   plan). A locale may get its own order later; it must keep the rule.
 *
 * Why 24, 36 and 60: three steps from a first core set to a fuller one, each
 * nesting in the next with the same origin; the existing template system
 * already renders any rows × columns grid, 60 cells still fit a landscape
 * tablet at a usable target size, and the word bank holds 60 core words with
 * distinct labels in all three locales (a larger size would need new
 * vocabulary, which needs a clinical reviewer first).
 *
 * Arrangement inside the 4×6 block follows the Fitzgerald key by column:
 * pronouns, three verb columns, descriptors, social words. Only words from
 * the existing word bank are used (no new vocabulary), and words whose
 * Spanish or French label repeats another word's label ("me"/"yo",
 * "do"/"hacer", "it"/"eso", "take"/"prendre", "don't"/"no") are left out so
 * no board shows two identical buttons.
 *
 * Status: PENDING CLINICAL REVIEW. The order and the selection await review
 * by a credentialed speech-language pathologist, like the word bank, the
 * translations and the symbol map. Every template built from it says so in
 * its metadata (`vocabularyReview`) and the UI says so where it is chosen.
 */

export type CoreGridTemplateId = 'core-24' | 'core-36' | 'core-60';

export interface CoreGridSize {
  templateId: CoreGridTemplateId;
  rows: number;
  columns: number;
  cells: number;
}

/** Ascending; each size's block is the top-left block of the next. */
export const CORE_GRID_SIZES: readonly CoreGridSize[] = [
  { templateId: 'core-24', rows: 4, columns: 6, cells: 24 },
  { templateId: 'core-36', rows: 6, columns: 6, cells: 36 },
  { templateId: 'core-60', rows: 6, columns: 10, cells: 60 },
];

/** Default size for a first board: middle of the family. */
export const DEFAULT_CORE_GRID_TEMPLATE: CoreGridTemplateId = 'core-36';

/** Review status carried by the template metadata of every core template. */
export const CORE_VOCABULARY_REVIEW = 'pending-clinical-review' as const;
export type CoreVocabularyReview = typeof CORE_VOCABULARY_REVIEW;

export function isCoreGridTemplateId(value: unknown): value is CoreGridTemplateId {
  return CORE_GRID_SIZES.some((size) => size.templateId === value);
}

export function coreGridSize(templateId: CoreGridTemplateId): CoreGridSize {
  const size = CORE_GRID_SIZES.find((item) => item.templateId === templateId);
  if (!size) throw new Error(`Unknown core grid template: ${String(templateId)}`);
  return size;
}

/**
 * The shared order, written as the cells it fills along the growth order.
 * Block 4×6 row by row, then the rows 4–5 the 6×6 grid adds, then the
 * columns 6–9 the 6×10 grid adds (row by row).
 */
const SHARED_CORE_ORDER: readonly string[] = [
  // 4×6 block — pronoun | verb | verb | verb | descriptor | social
  'i', 'want', 'go', 'stop', 'more', 'yes',
  'you', 'like', 'eat', 'look', 'good', 'no',
  'that', 'help', 'drink', 'put', 'bad', 'please',
  'my', 'see', 'make', 'get', 'different', 'all-done',
  // rows 4–5 added by 6×6
  'this', 'wait', 'come', 'turn', 'up', 'again',
  'what', 'play', 'open', 'feel', 'down', 'sorry',
  // columns 6–9 added by 6×10 — question/place | verb | descriptor | noun/social
  'who', 'listen', 'happy', 'home',
  'where', 'read', 'sad', 'school',
  'here', 'sleep', 'hurt', 'bathroom',
  'there', 'give', 'big', 'water',
  'in', 'walk', 'hot', 'food',
  'out', 'close', 'cold', 'thank-you',
];

/** One ordered core list per content locale (all three share one order today). */
export const CORE_ORDER_BY_LOCALE: Readonly<Record<StarterContentLocale, readonly string[]>> = {
  'es-MX': SHARED_CORE_ORDER,
  'en-US': SHARED_CORE_ORDER,
  'fr-FR': SHARED_CORE_ORDER,
};

/**
 * The fixed growth order of cells: every cell of the largest size, ordered so
 * that each size's block is a prefix.
 */
export function coreGrowthOrder(): GridPosition[] {
  const cells: GridPosition[] = [];
  let previous: CoreGridSize | undefined;
  for (const size of CORE_GRID_SIZES) {
    for (let row = 0; row < size.rows; row += 1) {
      for (let column = 0; column < size.columns; column += 1) {
        const inPrevious = previous !== undefined && row < previous.rows && column < previous.columns;
        if (!inPrevious) cells.push({ row, column });
      }
    }
    previous = size;
  }
  return cells;
}

/**
 * The en-US source buttons of a core size for `locale`'s order (labels are
 * localised afterwards by `localizeBoardContent`). Every button keeps the
 * word bank's part of speech (Fitzgerald colour) and lock, and the
 * allow-mapped Mulberry symbol or none (label-only).
 */
export function coreGridButtons(templateId: CoreGridTemplateId, locale: StarterContentLocale): BoardButton[] {
  const size = coreGridSize(templateId);
  const order = CORE_ORDER_BY_LOCALE[locale];
  const cells = coreGrowthOrder();
  if (order.length < size.cells) {
    throw new Error(`The ${locale} core order has ${order.length} words; ${templateId} needs ${size.cells}`);
  }
  return order.slice(0, size.cells).map((slug, index): BoardButton => {
    const word = coreWord(slug);
    const cell = cells[index];
    if (!word || !cell) throw new Error(`Core order entry ${index} (${slug}) has no word or no cell`);
    return {
      kind: 'analytic',
      id: createButtonId(word.id),
      label: word.label,
      speechText: word.speech ?? word.label,
      ...coreSymbolFields(word.id),
      locale: 'en-US',
      position: { row: cell.row, column: cell.column },
      locked: word.locked ?? false,
      partOfSpeech: word.pos,
    };
  });
}
