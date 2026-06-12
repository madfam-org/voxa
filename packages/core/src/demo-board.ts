import { createDemoCoreBoard } from './demo-experience.js';

export const DEMO_BOARD_ID = 'demo-core';

export function createDemoBoard() {
  return createDemoCoreBoard();
}

export { createStarterBoard, listStarterTemplates, type StarterTemplateId, type StarterTemplateMeta } from './starter-boards.js';
