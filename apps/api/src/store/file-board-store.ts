import { randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
  applyImportSnapBoard,
  applyImportTouchChatBoard,
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

/**
 * Directory holding `boards.json`: `VOXA_DATA_DIR` when set, else `./data`
 * relative to the working directory (`/app/data` in the container). Read on
 * every call so tests can point each process at its own directory.
 */
export function fileStoreDataDir(): string {
  const configured = process.env.VOXA_DATA_DIR?.trim();
  return configured ? resolve(configured) : join(process.cwd(), 'data');
}

export function boardStorePath(): string {
  return join(fileStoreDataDir(), 'boards.json');
}

function emptyState(): StoreState {
  const demo = createDemoBoard();
  return { boards: { [DEMO_BOARD_ID]: demo }, events: [] };
}

function loadState(): StoreState {
  const storePath = boardStorePath();
  if (!existsSync(storePath)) {
    return emptyState();
  }
  const raw = readFileSync(storePath, 'utf8');
  return JSON.parse(raw) as StoreState;
}

/**
 * Atomic replace: write a sibling temp file, fsync it, then rename it over
 * `filePath`. rename() on the same filesystem swaps the directory entry in one
 * step, so a reader (or a restart after a crash mid-write) sees either the old
 * file or the new one, never a truncated one.
 */
export function writeFileAtomic(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    const fd = openSync(tempPath, 'w');
    try {
      writeFileSync(fd, contents);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tempPath, filePath);
  } catch (err) {
    rmSync(tempPath, { force: true });
    throw err;
  }
}

function saveState(state: StoreState): void {
  writeFileAtomic(boardStorePath(), JSON.stringify(state, null, 2));
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

    async importSnapBoard(boardId, archive, actorUserId): Promise<ImportObfResult> {
      const result = await applyImportSnapBoard(state.boards, boardId, archive, actorUserId);
      state.events.push(result.event);
      persist();
      return result;
    },

    async importTouchChatBoard(boardId, archive, actorUserId): Promise<ImportObfResult> {
      const result = await applyImportTouchChatBoard(state.boards, boardId, archive, actorUserId);
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
