import type { Board, BoardId, BoardUpdateResult, SyncEvent, TeamRole } from '@voxa/core';

export interface ImportObfResult extends BoardUpdateResult {
  warnings: string[];
}

export interface BoardStore {
  listBoards(): Promise<Board[]>;
  getBoard(boardId: string): Promise<Board | undefined>;
  createBoard(board: Board, actorUserId: string): Promise<BoardUpdateResult>;
  updateBoard(
    boardId: string,
    next: Board,
    actorUserId: string,
    options?: { expectedVersion?: number; forceMotorPlanning?: boolean },
  ): Promise<BoardUpdateResult>;
  importObfBoard(
    boardId: string,
    rawObf: string,
    actorUserId: string,
  ): Promise<ImportObfResult>;
  importObzBoard(
    boardId: string,
    archive: Uint8Array,
    actorUserId: string,
  ): Promise<ImportObfResult>;
  importGridsetBoard(
    boardId: string,
    archive: Uint8Array,
    actorUserId: string,
  ): Promise<ImportObfResult>;
  exportObfBoard(boardId: string): Promise<string>;
  exportObzBoard(boardId: string): Promise<Uint8Array>;
  deleteBoard(boardId: string, actorUserId: string, role: TeamRole, actorOrgId?: string): Promise<void>;
  appendSyncEvents(events: SyncEvent[]): Promise<void>;
  getRecentEvents(boardId: BoardId, sinceVersion?: number): Promise<SyncEvent[]>;
  ensureSeeded?(): Promise<void>;
  ping?(): Promise<boolean>;
  resetStoreForTests?(): Promise<void>;
}

export type StoreDriver = 'postgres' | 'file';
