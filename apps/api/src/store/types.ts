import type { Board, BoardId, BoardUpdateResult, SyncEvent, TeamRole } from '@voxa/core';

/** Who is asking, as `teamAuth()` resolved it (see `canAccessBoard`). */
export interface BoardActor {
  userId: string;
  role: TeamRole;
  orgId?: string;
}

export interface BoardStore {
  /**
   * Boards the actor may read (voxa#16): the shared demo board, the actor's own
   * boards, and, for editors and admins with an `org_id`, their organization's
   * boards. The PostgreSQL store filters in SQL.
   */
  listBoardsForActor(actor: BoardActor): Promise<Board[]>;
  /** Number of boards owned by `userId` (plan limit check). */
  countBoardsOwnedBy(userId: string): Promise<number>;
  getBoard(boardId: string): Promise<Board | undefined>;
  createBoard(board: Board, actorUserId: string): Promise<BoardUpdateResult>;
  updateBoard(
    boardId: string,
    next: Board,
    actorUserId: string,
    options?: { expectedVersion?: number; forceMotorPlanning?: boolean },
  ): Promise<BoardUpdateResult>;
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
