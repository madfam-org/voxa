import {
  createBoardId,
  createButtonId,
  createProfileId,
  type Board,
  type BoardButton,
  type PartOfSpeechTag,
} from './index.js';

function demoButtons(): BoardButton[] {
  const core: Array<{
    id: string;
    label: string;
    speech: string;
    pos: PartOfSpeechTag;
    row: number;
    col: number;
    locked: boolean;
    glp?: boolean;
  }> = [
    { id: 'i', label: 'I', speech: 'I', pos: 'pronoun', row: 0, col: 0, locked: true },
    { id: 'want', label: 'want', speech: 'want', pos: 'verb', row: 0, col: 1, locked: true },
    { id: 'go', label: 'go', speech: 'go', pos: 'verb', row: 0, col: 2, locked: true },
    { id: 'more', label: 'more', speech: 'more', pos: 'preposition', row: 0, col: 3, locked: true },
    { id: 'help', label: 'help', speech: 'help me', pos: 'verb', row: 1, col: 0, locked: true },
    { id: 'stop', label: 'stop', speech: 'stop', pos: 'verb', row: 1, col: 1, locked: true },
    { id: 'eat', label: 'eat', speech: 'eat', pos: 'verb', row: 1, col: 2, locked: false },
    { id: 'drink', label: 'drink', speech: 'drink', pos: 'verb', row: 1, col: 3, locked: false },
    {
      id: 'glp-yay',
      label: 'Yay!',
      speech: 'Yay!',
      pos: 'preposition',
      row: 2,
      col: 0,
      locked: false,
      glp: true,
    },
    { id: 'home', label: 'home', speech: 'home', pos: 'noun', row: 2, col: 1, locked: false },
    { id: 'school', label: 'school', speech: 'school', pos: 'noun', row: 2, col: 2, locked: false },
    { id: 'friend', label: 'friend', speech: 'friend', pos: 'noun', row: 2, col: 3, locked: false },
  ];

  return core.map((item) => {
    const base = {
      id: createButtonId(item.id),
      locale: 'en-US',
      position: { row: item.row, column: item.col },
      locked: item.locked,
      partOfSpeech: item.pos,
    };

    if (item.glp) {
      return {
        ...base,
        kind: 'glp' as const,
        phrase: item.speech,
        intonationNotes: 'High pitch, elongated vowel',
      };
    }

    return {
      ...base,
      kind: 'analytic' as const,
      label: item.label,
      speechText: item.speech,
    };
  });
}

export const DEMO_BOARD_ID = 'demo-core';

export function createDemoBoard(): Board {
  return {
    id: createBoardId(DEMO_BOARD_ID),
    name: 'Core 47 Starter',
    profileId: createProfileId('demo-user'),
    version: 1,
    updatedAt: new Date().toISOString(),
    grid: {
      rows: 3,
      columns: 4,
      buttons: demoButtons(),
    },
  };
}
