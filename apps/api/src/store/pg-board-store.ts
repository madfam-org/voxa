import { and, eq, gt } from 'drizzle-orm';
import {
  createDemoBoard,
  DEMO_BOARD_ID,
  type Board,
  type BoardId,
  type BoardUpdateResult,
  type SyncEvent,
} from '@voxa/core';
import { createDb } from '../db/client.js';
import { boards, syncEvents } from '../db/schema.js';
import {
  applyCreateBoard,
  applyImportObfBoard,
  applyImportObzBoard,
  applyUpdateBoard,
  exportBoardObf,
  exportBoardObz,
  trimSyncEvents,
} from './board-operations.js';
import type { BoardStore, ImportObfResult } from './types.js';

function rowToBoard(row: typeof boards.$inferSelect): Board {
  return {
    id: row.id as Board['id'],
    name: row.name,
    profileId: row.profileId as Board['profileId'],
    grid: row.grid as Board['grid'],
    version: row.version,
    updatedAt: row.updatedAt,
    ownerUserId: row.ownerUserId ?? undefined,
    orgId: row.orgId ?? undefined,
  };
}

export function createPgBoardStore(databaseUrl: string): BoardStore {
  const { db, client } = createDb(databaseUrl);

  async function loadBoardMap(): Promise<Record<string, Board>> {
    const rows = await db.select().from(boards);
    const map: Record<string, Board> = {};
    for (const row of rows) {
      map[row.id] = rowToBoard(row);
    }
    return map;
  }

  async function persistBoard(board: Board): Promise<void> {
    await db
      .insert(boards)
      .values({
        id: board.id as string,
        name: board.name,
        profileId: board.profileId as string,
        ownerUserId: board.ownerUserId ?? null,
        orgId: board.orgId ?? null,
        grid: board.grid,
        version: board.version,
        updatedAt: board.updatedAt,
      })
      .onConflictDoUpdate({
        target: boards.id,
        set: {
          name: board.name,
          profileId: board.profileId as string,
          ownerUserId: board.ownerUserId ?? null,
          orgId: board.orgId ?? null,
          grid: board.grid,
          version: board.version,
          updatedAt: board.updatedAt,
        },
      });
  }

  async function persistEvent(event: SyncEvent): Promise<void> {
    await db.insert(syncEvents).values({
      id: event.id,
      type: event.type,
      boardId: event.boardId as string,
      version: event.version,
      actorUserId: event.actorUserId,
      timestamp: event.timestamp,
      payload: event.payload ?? null,
    });
  }

  async function trimEvents(): Promise<void> {
    const countRows = await db.select({ id: syncEvents.id }).from(syncEvents);
    if (countRows.length <= 5000) return;

    const keepFrom = countRows.length - 5000;
    const stale = countRows.slice(0, keepFrom).map((row) => row.id);
    if (stale.length === 0) return;

    for (const id of stale) {
      await db.delete(syncEvents).where(eq(syncEvents.id, id));
    }
  }

  return {
    async listBoards() {
      const rows = await db.select().from(boards);
      return rows.map(rowToBoard);
    },

    async getBoard(boardId: string) {
      const rows = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
      return rows[0] ? rowToBoard(rows[0]) : undefined;
    },

    async createBoard(board: Board, actorUserId: string): Promise<BoardUpdateResult> {
      const map = await loadBoardMap();
      const result = applyCreateBoard(map, board, actorUserId);
      await persistBoard(result.board);
      await persistEvent(result.event);
      return result;
    },

    async updateBoard(boardId, next, actorUserId, options) {
      const map = await loadBoardMap();
      const result = applyUpdateBoard(map, boardId, next, actorUserId, options);
      await persistBoard(result.board);
      await persistEvent(result.event);
      return result;
    },

    async importObfBoard(boardId, rawObf, actorUserId): Promise<ImportObfResult> {
      const map = await loadBoardMap();
      const result = applyImportObfBoard(map, boardId, rawObf, actorUserId);
      await persistBoard(result.board);
      await persistEvent(result.event);
      return result;
    },

    async importObzBoard(boardId, archive, actorUserId): Promise<ImportObfResult> {
      const map = await loadBoardMap();
      const result = applyImportObzBoard(map, boardId, archive, actorUserId);
      await persistBoard(result.board);
      await persistEvent(result.event);
      return result;
    },

    async exportObfBoard(boardId: string) {
      const map = await loadBoardMap();
      return exportBoardObf(map, boardId);
    },

    async exportObzBoard(boardId: string) {
      const map = await loadBoardMap();
      return exportBoardObz(map, boardId);
    },

    async appendSyncEvents(events: SyncEvent[]) {
      for (const event of events) {
        await persistEvent(event);
      }
      await trimEvents();
    },

    async getRecentEvents(boardId: BoardId, sinceVersion = 0) {
      const rows = await db
        .select()
        .from(syncEvents)
        .where(and(eq(syncEvents.boardId, boardId as string), gt(syncEvents.version, sinceVersion)))
        .orderBy(syncEvents.version);

      return rows.map(
          (row): SyncEvent => ({
            id: row.id,
            type: row.type as SyncEvent['type'],
            boardId: row.boardId as BoardId,
            version: row.version,
            actorUserId: row.actorUserId,
            timestamp: row.timestamp,
            payload: (row.payload as Record<string, unknown> | null) ?? undefined,
          }),
        );
    },

    async ensureSeeded() {
      const existing = await db.select({ id: boards.id }).from(boards).limit(1);
      if (existing.length > 0) return;

      const demo = createDemoBoard();
      await persistBoard(demo);
    },

    async ping() {
      try {
        await client`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    },

    async resetStoreForTests() {
      await db.delete(syncEvents);
      await db.delete(boards);
      const demo = createDemoBoard();
      await persistBoard(demo);
    },
  };
}
