import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createDemoBoard,
  DEMO_BOARD_ID,
  type Board,
  type BoardId,
  type BoardUpdateResult,
  type SyncEvent,
  type TeamRole,
} from '@voxa/core';
import { canEditBoard } from '../lib/board-access.js';
import {
  applyCreateBoard,
  applyDeleteBoard,
  applyImportObfBoard,
  applyImportObzBoard,
  applyImportGridsetBoard,
  applyUpdateBoard,
  exportBoardObf,
  exportBoardObz,
  trimSyncEvents,
} from './board-operations.js';
import type { BoardStore, ImportObfResult } from './types.js';

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

export function createFileBoardStore(initialState?: StoreState): BoardStore {
  let state = initialState ?? loadState();

  function persist(): void {
    saveState(state);
  }

  return {
    async listBoards() {
      return Object.values(state.boards);
    },

    async getBoard(boardId: string) {
      return state.boards[boardId];
    },

    async createBoard(board: Board, actorUserId: string): Promise<BoardUpdateResult> {
      const result = applyCreateBoard(state.boards, board, actorUserId);
      state.events.push(result.event);
      persist();
      return result;
    },

    async updateBoard(boardId, next, actorUserId, options) {
      const result = applyUpdateBoard(state.boards, boardId, next, actorUserId, options);
      state.events.push(result.event);
      persist();
      return result;
    },

    async importObfBoard(boardId, rawObf, actorUserId): Promise<ImportObfResult> {
      const result = applyImportObfBoard(state.boards, boardId, rawObf, actorUserId);
      state.events.push(result.event);
      persist();
      return result;
    },

    async importObzBoard(boardId, archive, actorUserId): Promise<ImportObfResult> {
      const result = applyImportObzBoard(state.boards, boardId, archive, actorUserId);
      state.events.push(result.event);
      persist();
      return result;
    },

    async importGridsetBoard(boardId, archive, actorUserId): Promise<ImportObfResult> {
      const result = applyImportGridsetBoard(state.boards, boardId, archive, actorUserId);
      state.events.push(result.event);
      persist();
      return result;
    },

    async exportObfBoard(boardId: string) {
      return exportBoardObf(state.boards, boardId);
    },

    async exportObzBoard(boardId: string) {
      return exportBoardObz(state.boards, boardId);
    },

    async deleteBoard(boardId: string, actorUserId: string, role: TeamRole, actorOrgId?: string) {
      const board = state.boards[boardId];
      if (!board) throw new Error(`Board not found: ${boardId}`);
      if (!canEditBoard(boardId, board.ownerUserId, actorUserId, role, board.orgId, actorOrgId)) {
        const err = new Error('Forbidden');
        (err as Error & { status: number }).status = 403;
        throw err;
      }
      applyDeleteBoard(state.boards, boardId);
      persist();
    },

    async appendSyncEvents(events: SyncEvent[]) {
      state.events.push(...events);
      state.events = trimSyncEvents(state.events);
      persist();
    },

    async getRecentEvents(boardId: BoardId, sinceVersion = 0) {
      return state.events.filter((e) => e.boardId === boardId && e.version > sinceVersion);
    },

    async resetStoreForTests() {
      state = emptyState();
      persist();
    },
  };
}
