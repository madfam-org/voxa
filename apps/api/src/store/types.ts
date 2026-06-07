import type { Board, BoardId, BoardUpdateResult, SyncEvent } from '@voxa/core';

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
  exportObfBoard(boardId: string): Promise<string>;
  appendSyncEvents(events: SyncEvent[]): Promise<void>;
  getRecentEvents(boardId: BoardId, sinceVersion?: number): Promise<SyncEvent[]>;
  ensureSeeded?(): Promise<void>;
  ping?(): Promise<boolean>;
  resetStoreForTests?(): Promise<void>;
}

export type StoreDriver = 'postgres' | 'file';
