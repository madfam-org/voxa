import { createBoardId, createButtonId, createProfileId, type Board, type BoardButton } from './index.js';
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
    description: 'Classic AAC grid — ARASAAC symbols, Fitzgerald colors, sentence bar',
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

/** ARASAAC pictogram IDs for Core 47 demo words (curated for clarity). */
const CORE_SYMBOL_IDS: Record<string, number> = {
  i: 2280,
  you: 2281,
  want: 5441,
  more: 5508,
  go: 8142,
  stop: 7196,
  help: 4570,
  eat: 6456,
  drink: 6061,
  yes: 5584,
  no: 5526,
  please: 8195,
  like: 37826,
  dont: 34021,
  different: 4628,
  again: 37163,
  'all-done': 39109,
  wait: 36914,
  look: 6564,
  listen: 6572,
  come: 32669,
  turn: 6630,
  put: 32757,
  get: 24208,
  make: 32751,
  do: 32751,
  see: 2474,
  feel: 3293,
  good: 4581,
  bad: 5504,
  sorry: 11625,
  'thank-you': 8129,
  me: 6632,
  my: 12264,
  it: 31670,
  that: 6906,
  this: 7095,
  here: 5382,
  there: 5375,
  up: 5388,
  down: 37428,
  in: 5439,
  out: 8252,
  on: 7814,
  off: 7020,
  home: 6882,
  school: 32446,
};

function arasaacSymbolUrl(pictogramId: number): string {
  return `https://static.arasaac.org/pictograms/${pictogramId}/${pictogramId}_300.png`;
}

function withCoreSymbols(board: Board): Board {
  return {
    ...board,
    grid: {
      ...board.grid,
      buttons: board.grid.buttons.map((button) => {
        if (button.kind !== 'analytic') return button;
        const slug = button.id as string;
        const pictogramId = CORE_SYMBOL_IDS[slug];
        return pictogramId ? { ...button, symbolUrl: arasaacSymbolUrl(pictogramId) } : button;
      }),
    },
  };
}

export function createDemoCoreBoard(): Board {
  return withCoreSymbols(
    createStarterBoard('core-47', {
      boardId: 'demo-core',
      name: 'Core 47',
      profileId: 'demo-user',
    }),
  );
}

export function createDemoLiteracyBoard(): Board {
  return createLiteracyKeyboardBoard({
    boardId: 'demo-literacy',
    name: 'Literacy Keyboard Demo',
    profileId: 'demo-user',
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
    { id: 'yes', label: 'yes', speech: 'yes', pos: 'preposition' as const },
    { id: 'no', label: 'no', speech: 'no', pos: 'preposition' as const },
    { id: 'more', label: 'more', speech: 'more', pos: 'preposition' as const },
    { id: 'help', label: 'help', speech: 'help me', pos: 'verb' as const },
  ];

  const buttons: BoardButton[] = words.map((word, index) => ({
    kind: 'analytic',
    id: createButtonId(word.id),
    label: word.label,
    speechText: word.speech,
    symbolUrl: arasaacSymbolUrl(CORE_SYMBOL_IDS[word.id]!),
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

export function boardForDemoScene(scene: DemoSceneId): Board {
  switch (scene) {
    case 'communicate':
      return createDemoCoreBoard();
    case 'literacy':
      return createDemoLiteracyBoard();
    case 'schedule':
      return createDemoScheduleBoard();
    case 'access':
      return createDemoAccessBoard();
    default:
      return createDemoCoreBoard();
  }
}
