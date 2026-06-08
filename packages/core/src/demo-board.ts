import { createStarterBoard } from './starter-boards.js';

export const DEMO_BOARD_ID = 'demo-core';

export function createDemoBoard() {
  return createStarterBoard('core-47', {
    boardId: DEMO_BOARD_ID,
    profileId: 'demo-user',
  });
}

export { createStarterBoard, listStarterTemplates, type StarterTemplateId, type StarterTemplateMeta } from './starter-boards.js';
