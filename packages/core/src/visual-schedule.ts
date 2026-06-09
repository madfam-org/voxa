import {
  createBoardId,
  createButtonId,
  createProfileId,
  type Board,
  type BoardButton,
} from './index.js';

export function isVisualScheduleBoard(board: Pick<Board, 'layout'>): boolean {
  return board.layout === 'visual-schedule';
}

/** Schedule steps in timeline order (row-major, single column). */
export function listScheduleSteps(board: Pick<Board, 'grid'>): BoardButton[] {
  return [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );
}

export function scheduleProgress(
  completedIds: ReadonlySet<string>,
  steps: BoardButton[],
): { completed: number; total: number; currentStepId: string | null } {
  const total = steps.length;
  const completed = steps.filter((step) => completedIds.has(step.id as string)).length;
  const current = steps.find((step) => !completedIds.has(step.id as string));
  return {
    completed,
    total,
    currentStepId: (current?.id as string) ?? null,
  };
}

interface ScheduleStepSpec {
  id: string;
  label: string;
  speech?: string;
}

const DAILY_ROUTINE_STEPS: ScheduleStepSpec[] = [
  { id: 'wake-up', label: 'Wake up' },
  { id: 'get-dressed', label: 'Get dressed' },
  { id: 'eat-breakfast', label: 'Eat breakfast' },
  { id: 'brush-teeth', label: 'Brush teeth' },
  { id: 'pack-backpack', label: 'Pack backpack' },
  { id: 'go-to-school', label: 'Go to school' },
  { id: 'all-done', label: 'All done', speech: 'all done' },
];

function stepButton(spec: ScheduleStepSpec, row: number): BoardButton {
  return {
    kind: 'analytic',
    id: createButtonId(spec.id),
    label: spec.label,
    speechText: spec.speech ?? spec.label,
    locale: 'en-US',
    position: { row, column: 0 },
    locked: false,
    partOfSpeech: 'noun',
  };
}

/** Vertical daily-routine visual schedule — one step per row. */
export function createVisualScheduleBoard(options?: {
  boardId?: string;
  name?: string;
  profileId?: string;
}): Board {
  const buttons = DAILY_ROUTINE_STEPS.map((spec, row) => stepButton(spec, row));
  return {
    id: createBoardId(options?.boardId ?? 'starter-visual-schedule'),
    name: options?.name ?? 'Daily Routine',
    profileId: createProfileId(options?.profileId ?? 'default'),
    layout: 'visual-schedule',
    version: 1,
    updatedAt: new Date().toISOString(),
    grid: {
      rows: buttons.length,
      columns: 1,
      buttons,
    },
  };
}
