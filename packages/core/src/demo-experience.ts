import { createBoardId, createButtonId, createProfileId, type Board, type BoardButton } from './index.js';
import { coreSymbolFields } from './core-symbols.js';
import {
  demoContentLocale,
  localizeDemoBoard,
  type DemoUiLocale,
  type StarterContentLocale,
} from './demo-locale.js';
import { createLiteracyKeyboardBoard } from './literacy-keyboard.js';
import { createStarterBoard } from './starter-boards.js';
import { createVisualScheduleBoard } from './visual-schedule.js';

export type DemoSceneId = 'communicate' | 'literacy' | 'schedule' | 'access';

export interface DemoSceneMeta {
  id: DemoSceneId;
  name: string;
  description: string;
}

export const DEMO_SCENE_META: DemoSceneMeta[] = [
  {
    id: 'communicate',
    name: 'Core vocabulary',
    description: 'Classic AAC grid — Mulberry symbols, Fitzgerald colors, sentence bar',
  },
  {
    id: 'literacy',
    name: 'Literacy keyboard',
    description: 'QWERTY typing for literate AAC users with AI word suggestions in the full app',
  },
  {
    id: 'schedule',
    name: 'Visual schedule',
    description: 'Daily routine timeline with step completion and spoken labels',
  },
  {
    id: 'access',
    name: 'Access modes',
    description: 'Try switch scanning and touch guard overlays on a compact grid',
  },
];

/** Core 47 demo board; symbols come from the core allow-map (`core-symbols.ts`). */
export function createDemoCoreBoard(): Board {
  return createStarterBoard('core-47', {
    boardId: 'demo-core',
    name: 'Core 47',
    profileId: 'demo-user',
  });
}

export function createDemoLiteracyBoard(locale?: StarterContentLocale): Board {
  return createLiteracyKeyboardBoard({
    boardId: 'demo-literacy',
    name: 'Literacy Keyboard Demo',
    profileId: 'demo-user',
    locale,
  });
}

export function createDemoScheduleBoard(): Board {
  return createVisualScheduleBoard({
    boardId: 'demo-schedule',
    name: 'Daily Routine Demo',
    profileId: 'demo-user',
  });
}

/** Compact grid for access-mode previews in the visitor demo. */
export function createDemoAccessBoard(): Board {
  const words = [
    { id: 'yes', label: 'yes', speech: 'yes', pos: 'social' as const },
    { id: 'no', label: 'no', speech: 'no', pos: 'social' as const },
    { id: 'more', label: 'more', speech: 'more', pos: 'preposition' as const },
    { id: 'help', label: 'help', speech: 'help me', pos: 'verb' as const },
  ];

  const buttons: BoardButton[] = words.map((word, index) => ({
    kind: 'analytic',
    id: createButtonId(word.id),
    label: word.label,
    speechText: word.speech,
    ...coreSymbolFields(word.id),
    locale: 'en-US',
    position: { row: Math.floor(index / 2), column: index % 2 },
    locked: false,
    partOfSpeech: word.pos,
  }));

  return {
    id: createBoardId('demo-access'),
    name: 'Access Preview',
    profileId: createProfileId('demo-user'),
    version: 1,
    updatedAt: new Date().toISOString(),
    grid: { rows: 2, columns: 2, buttons },
  };
}

export function boardForDemoScene(scene: DemoSceneId, locale: DemoUiLocale = 'es'): Board {
  let board: Board;
  switch (scene) {
    case 'communicate':
      board = createDemoCoreBoard();
      break;
    case 'literacy':
      board = createDemoLiteracyBoard(demoContentLocale(locale));
      break;
    case 'schedule':
      board = createDemoScheduleBoard();
      break;
    case 'access':
      board = createDemoAccessBoard();
      break;
    default:
      board = createDemoCoreBoard();
  }
  return localizeDemoBoard(board, locale);
}
