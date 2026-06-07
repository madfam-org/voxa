import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createBoardId,
  createDemoBoard,
  DEMO_BOARD_ID,
  type Board,
  type BoardId,
  type SyncEvent,
} from '@voxa/core';
import { findMotorPlanningViolations } from '@voxa/vocabulary';
import { obfToVoxaButtons, parseObfJson, voxaBoardToObf } from '@voxa/obf';

interface StoreState {
  boards: Record<string, Board>;
  events: SyncEvent[];
}

const DATA_DIR = join(process.cwd(), 'data');
const STORE_PATH = join(DATA_DIR, 'boards.json');

function emptyState(): StoreState {
  const demo = createDemoBoard();
  return { boards: { [DEMO_BOARD_ID]: demo }, events: [] };
}

function loadState(): StoreState {
  if (!existsSync(STORE_PATH)) {
    return emptyState();
  }
  const raw = readFileSync(STORE_PATH, 'utf8');
  return JSON.parse(raw) as StoreState;
}

function saveState(state: StoreState): void {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
}

let state = loadState();

function persist(): void {
  saveState(state);
}

function createEvent(
  type: SyncEvent['type'],
  board: Board,
  actorUserId: string,
  payload?: Record<string, unknown>,
): SyncEvent {
  return {
    id: randomUUID(),
    type,
    boardId: board.id,
    version: board.version,
    actorUserId,
    timestamp: new Date().toISOString(),
    payload,
  };
}

export function listBoards(): Board[] {
  return Object.values(state.boards);
}

export function getBoard(boardId: string): Board | undefined {
  return state.boards[boardId];
}

export function createBoard(board: Board, actorUserId: string): { board: Board; event: SyncEvent } {
  const id = board.id as string;
  if (state.boards[id]) {
    throw new Error(`Board already exists: ${id}`);
  }
  const stored: Board = { ...board, updatedAt: new Date().toISOString() };
  state.boards[id] = stored;
  const event = createEvent('board.created', stored, actorUserId);
  state.events.push(event);
  persist();
  return { board: stored, event };
}

export function updateBoard(
  boardId: string,
  next: Board,
  actorUserId: string,
  options?: { expectedVersion?: number; forceMotorPlanning?: boolean },
): { board: Board; event: SyncEvent } {
  const current = state.boards[boardId];
  if (!current) {
    throw new Error(`Board not found: ${boardId}`);
  }

  if (options?.expectedVersion !== undefined && current.version !== options.expectedVersion) {
    const err = new Error('Board version conflict');
    (err as Error & { status: number }).status = 409;
    throw err;
  }

  const violations = findMotorPlanningViolations(current.grid.buttons, next.grid.buttons);
  if (violations.length > 0 && !options?.forceMotorPlanning) {
    const err = new Error('Motor planning violation');
    (err as Error & { status: number; details: unknown }).status = 422;
    (err as Error & { details: unknown }).details = {
      code: 'MOTOR_PLANNING_VIOLATION',
      violations,
    };
    throw err;
  }

  const stored: Board = {
    ...next,
    id: createBoardId(boardId),
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  };
  state.boards[boardId] = stored;
  const event = createEvent('board.updated', stored, actorUserId);
  state.events.push(event);
  persist();
  return { board: stored, event };
}

export function importObfBoard(
  boardId: string,
  rawObf: string,
  actorUserId: string,
): { board: Board; event: SyncEvent; warnings: string[] } {
  const current = getBoard(boardId);
  if (!current) {
    throw new Error(`Board not found: ${boardId}`);
  }

  const { board: obf, warnings } = parseObfJson(rawObf);
  const buttons = obfToVoxaButtons(obf);

  const next: Board = {
    ...current,
    name: obf.name || current.name,
    grid: {
      rows: obf.grid.rows,
      columns: obf.grid.columns,
      buttons,
    },
  };

  const result = updateBoard(boardId, next, actorUserId, {
    expectedVersion: current.version,
    forceMotorPlanning: true,
  });

  return { ...result, warnings };
}

export function exportObfBoard(boardId: string): string {
  const board = getBoard(boardId);
  if (!board) {
    throw new Error(`Board not found: ${boardId}`);
  }
  return JSON.stringify(voxaBoardToObf(board), null, 2);
}

export function appendSyncEvents(events: SyncEvent[]): void {
  state.events.push(...events);
  if (state.events.length > 5000) {
    state.events = state.events.slice(-5000);
  }
  persist();
}

export function getRecentEvents(boardId: BoardId, sinceVersion = 0): SyncEvent[] {
  return state.events.filter((e) => e.boardId === boardId && e.version > sinceVersion);
}

/** Test helper — reset in-memory store */
export function resetStoreForTests(): void {
  state = emptyState();
  persist();
}
