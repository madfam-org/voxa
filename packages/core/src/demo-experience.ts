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
    description: 'Motor-plan core words with ARASAAC symbols and Fitzgerald colors',
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

const CORE_SYMBOLS: Record<string, string> = {
  i: 'https://static.arasaac.org/pictograms/2280/2280_300.png',
  you: 'https://static.arasaac.org/pictograms/2281/2281_300.png',
  want: 'https://static.arasaac.org/pictograms/7034/7034_300.png',
  more: 'https://static.arasaac.org/pictograms/6845/6845_300.png',
  help: 'https://static.arasaac.org/pictograms/6405/6405_300.png',
  home: 'https://static.arasaac.org/pictograms/6882/6882_300.png',
  yes: 'https://static.arasaac.org/pictograms/6818/6818_300.png',
  no: 'https://static.arasaac.org/pictograms/6819/6819_300.png',
};

function withCoreSymbols(board: Board, slugs: string[]): Board {
  return {
    ...board,
    grid: {
      ...board.grid,
      buttons: board.grid.buttons.map((button) => {
        if (button.kind !== 'analytic') return button;
        const slug = button.id as string;
        if (!slugs.includes(slug)) return button;
        const symbolUrl = CORE_SYMBOLS[slug];
        return symbolUrl ? { ...button, symbolUrl } : button;
      }),
    },
  };
}

export function createDemoCoreBoard(): Board {
  return withCoreSymbols(
    createStarterBoard('core-47', {
      boardId: 'demo-core',
      name: 'Core 47 Demo',
      profileId: 'demo-user',
    }),
    Object.keys(CORE_SYMBOLS),
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
    symbolUrl: CORE_SYMBOLS[word.id],
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
