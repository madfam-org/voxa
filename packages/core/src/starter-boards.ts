import {
  createBoardId,
  createButtonId,
  createProfileId,
  type Board,
  type BoardButton,
} from './index.js';
import { coreSymbolFields } from './core-symbols.js';
import {
  CORE_GRID_SIZES,
  CORE_VOCABULARY_REVIEW,
  coreGridButtons,
  coreGridSize,
  isCoreGridTemplateId,
  type CoreGridTemplateId,
  type CoreVocabularyReview,
} from './core-grid-sizes.js';
import { CORE_100_EXTRA, CORE_47_WORDS, type StarterWord } from './core-word-bank.js';
import { localizeBoardContent, type StarterContentLocale } from './demo-locale.js';
import { createLiteracyKeyboardBoard } from './literacy-keyboard.js';
import { createVisualScheduleBoard } from './visual-schedule.js';

export type StarterTemplateId =
  | CoreGridTemplateId
  | 'core-47'
  | 'core-100'
  | 'literacy-keyboard'
  | 'visual-schedule';

const OTHER_TEMPLATE_IDS: readonly StarterTemplateId[] = ['core-47', 'core-100', 'literacy-keyboard', 'visual-schedule'];

/** True for a template id `createStarterBoard` can build (input validation at the API edge). */
export function isStarterTemplateId(value: unknown): value is StarterTemplateId {
  return isCoreGridTemplateId(value) || (OTHER_TEMPLATE_IDS as readonly unknown[]).includes(value);
}

export {
  isStarterContentLocale,
  STARTER_CONTENT_LOCALES,
  type StarterContentLocale,
} from './demo-locale.js';

export interface StarterBoardOptions {
  boardId?: string;
  name?: string;
  profileId?: string;
  /**
   * Content locale the template is produced in: labels, speech text and each
   * button's `locale`. Defaults to `en-US` (the source vocabulary).
   */
  locale?: StarterContentLocale;
}

export interface StarterTemplateMeta {
  id: StarterTemplateId;
  name: string;
  description: string;
  rows: number;
  columns: number;
  wordCount: number;
  /** Core vocabulary templates: the clinical review status of the word selection and layout. */
  vocabularyReview?: CoreVocabularyReview;
  /**
   * Core sizes that share one motor plan (`core-grid-sizes.ts`): every word
   * keeps its row and column in each larger size of the same family.
   */
  motorPlanFamily?: 'core-sizes';
}

const TEMPLATE_LAYOUT: Record<Extract<StarterTemplateId, 'core-47' | 'core-100'>, { rows: number; columns: number; words: StarterWord[] }> = {
  'core-47': { rows: 6, columns: 8, words: CORE_47_WORDS },
  'core-100': { rows: 10, columns: 10, words: [...CORE_47_WORDS, ...CORE_100_EXTRA] },
};

export function listStarterTemplates(): StarterTemplateMeta[] {
  const sizedTemplates: StarterTemplateMeta[] = CORE_GRID_SIZES.map((size) => ({
    id: size.templateId,
    name: `Core ${size.cells}`,
    description: `Core vocabulary, ${size.cells} cells (${size.rows}×${size.columns}); every word keeps its place in the larger sizes`,
    rows: size.rows,
    columns: size.columns,
    wordCount: size.cells,
    vocabularyReview: CORE_VOCABULARY_REVIEW,
    motorPlanFamily: 'core-sizes',
  }));
  const coreTemplates = (Object.keys(TEMPLATE_LAYOUT) as Array<'core-47' | 'core-100'>).map((id) => {
    const layout = TEMPLATE_LAYOUT[id];
    return {
      id,
      name: id === 'core-47' ? 'Core 47 Starter' : 'Core 100 Starter',
      description:
        id === 'core-47'
          ? 'Motor-plan locked core vocabulary (47 words, 6×8 grid)'
          : 'Expanded core + fringe vocabulary (100 words, 10×10 grid)',
      rows: layout.rows,
      columns: layout.columns,
      wordCount: layout.words.length,
      vocabularyReview: CORE_VOCABULARY_REVIEW,
    };
  });

  const literacy = createLiteracyKeyboardBoard();
  const schedule = createVisualScheduleBoard();
  return [
    ...sizedTemplates,
    ...coreTemplates,
    {
      id: 'literacy-keyboard',
      name: 'Literacy Keyboard',
      description: 'QWERTY text keyboard for literate users with word suggestions',
      rows: literacy.grid.rows,
      columns: literacy.grid.columns,
      wordCount: literacy.grid.buttons.length,
    },
    {
      id: 'visual-schedule',
      name: 'Daily Routine Schedule',
      description: 'Vertical visual schedule with step completion for daily routines',
      rows: schedule.grid.rows,
      columns: schedule.grid.columns,
      wordCount: schedule.grid.buttons.length,
    },
  ];
}

function wordToButton(word: StarterWord, row: number, column: number): BoardButton {
  return {
    kind: 'analytic',
    id: createButtonId(word.id),
    label: word.label,
    speechText: word.speech ?? word.label,
    ...coreSymbolFields(word.id),
    locale: 'en-US',
    position: { row, column },
    locked: word.locked ?? false,
    partOfSpeech: word.pos,
  };
}

function layoutStarterWords(words: StarterWord[], rows: number, columns: number): BoardButton[] {
  const capacity = rows * columns;
  return words.slice(0, capacity).map((word, index) =>
    wordToButton(word, Math.floor(index / columns), index % columns),
  );
}

export function createStarterBoard(
  templateId: StarterTemplateId,
  options?: StarterBoardOptions,
): Board {
  const locale = options?.locale ?? 'en-US';
  if (templateId === 'literacy-keyboard') {
    return createLiteracyKeyboardBoard({ ...options, locale });
  }
  if (templateId === 'visual-schedule') {
    return localizeBoardContent(createVisualScheduleBoard(options), locale);
  }
  if (isCoreGridTemplateId(templateId)) {
    return localizeBoardContent(createCoreGridBoard(templateId, locale, options), locale);
  }

  const layout = TEMPLATE_LAYOUT[templateId];
  return localizeBoardContent(createCoreBoard(templateId, layout, options), locale);
}

function createCoreBoard(
  templateId: Extract<StarterTemplateId, 'core-47' | 'core-100'>,
  layout: { rows: number; columns: number; words: StarterWord[] },
  options?: StarterBoardOptions,
): Board {
  return {
    id: createBoardId(options?.boardId ?? `starter-${templateId}`),
    name: options?.name ?? (templateId === 'core-47' ? 'Core 47 Starter' : 'Core 100 Starter'),
    profileId: createProfileId(options?.profileId ?? 'default'),
    version: 1,
    updatedAt: new Date().toISOString(),
    grid: {
      rows: layout.rows,
      columns: layout.columns,
      buttons: layoutStarterWords(layout.words, layout.rows, layout.columns),
    },
  };
}

function createCoreGridBoard(
  templateId: CoreGridTemplateId,
  locale: StarterContentLocale,
  options?: StarterBoardOptions,
): Board {
  const size = coreGridSize(templateId);
  return {
    id: createBoardId(options?.boardId ?? `starter-${templateId}`),
    name: options?.name ?? `Core ${size.cells}`,
    profileId: createProfileId(options?.profileId ?? 'default'),
    version: 1,
    updatedAt: new Date().toISOString(),
    grid: { rows: size.rows, columns: size.columns, buttons: coreGridButtons(templateId, locale) },
  };
}
