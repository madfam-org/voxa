import { and, count, desc, eq, gt, inArray, or, type SQL } from 'drizzle-orm';
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
import { getSharedDb } from '../db/client.js';
import { boards, syncEvents } from '../db/schema.js';
import {
  applyCreateBoard,
  applyUpdateBoard,
  assertSyncEventBatch,
  boardVersionConflict,
  exportBoardObf,
  exportBoardObz,
  MAX_SYNC_EVENTS_PER_BOARD,
} from './board-operations.js';
import type { BoardActor, BoardStore } from './types.js';

function rowToBoard(row: typeof boards.$inferSelect): Board {
  const board: Board = {
    id: row.id as Board['id'],
    name: row.name,
    profileId: row.profileId as Board['profileId'],
    grid: row.grid as Board['grid'],
    version: row.version,
    updatedAt: row.updatedAt,
    ownerUserId: row.ownerUserId ?? undefined,
    orgId: row.orgId ?? undefined,
  };
  // Absent stays absent (as in the file store), so a round trip is identical.
  if (row.layout !== null) board.layout = row.layout as Board['layout'];
  if (row.display !== null) board.display = row.display as Board['display'];
  return board;
}

/** Columns written for a board's content (everything but id, owner and org). */
function contentColumns(board: Board) {
  return {
    name: board.name,
    profileId: board.profileId as string,
    grid: board.grid,
    layout: board.layout ?? null,
    display: board.display ?? null,
    version: board.version,
    updatedAt: board.updatedAt,
  };
}

/**
 * How many times a write without `expectedVersion` re-reads the board and
 * tries again after losing a race. Writes WITH `expectedVersion` never retry:
 * the loser gets 409 and the board's current version.
 */
const UNVERSIONED_WRITE_ATTEMPTS = 3;

export function createPgBoardStore(databaseUrl: string): BoardStore {
  const { db, client } = getSharedDb(databaseUrl);
  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  /** One board by id, as the single-entry map the board operations take. */
  async function loadOne(boardId: string): Promise<Record<string, Board>> {
    const rows = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
    return rows[0] ? { [rows[0].id]: rowToBoard(rows[0]) } : {};
  }

  async function insertEvent(tx: Tx, event: SyncEvent): Promise<void> {
    await tx.insert(syncEvents).values({
      id: event.id,
      type: event.type,
      boardId: event.boardId as string,
      version: event.version,
      actorUserId: event.actorUserId,
      timestamp: event.timestamp,
      payload: event.payload ?? null,
    });
  }

  /**
   * Keep the newest MAX_SYNC_EVENTS_PER_BOARD events of one board, in one
   * statement. Per board, so one board's activity never trims another board's
   * audit history.
   */
  async function trimBoardEvents(tx: Tx, boardId: string): Promise<void> {
    const stale = tx
      .select({ id: syncEvents.id })
      .from(syncEvents)
      .where(eq(syncEvents.boardId, boardId))
      .orderBy(desc(syncEvents.version), desc(syncEvents.timestamp))
      .offset(MAX_SYNC_EVENTS_PER_BOARD);
    await tx
      .delete(syncEvents)
      .where(and(eq(syncEvents.boardId, boardId), inArray(syncEvents.id, stale)));
  }

  async function recordEvent(tx: Tx, event: SyncEvent): Promise<void> {
    await insertEvent(tx, event);
    await trimBoardEvents(tx, event.boardId as string);
  }

  /**
   * Writes `result.board` only if the stored row still has `previousVersion`
   * (compare-and-set), and records its event in the same transaction. Of two
   * writers that read the same version, exactly one updates a row; the other
   * gets a 409 carrying the version that won.
   */
  async function commitBoardChange(
    previousVersion: number,
    result: BoardUpdateResult,
  ): Promise<void> {
    const board = result.board;
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(boards)
        .set(contentColumns(board))
        .where(and(eq(boards.id, board.id as string), eq(boards.version, previousVersion)))
        .returning({ id: boards.id });
      if (updated.length === 0) {
        const current = await tx
          .select({ version: boards.version })
          .from(boards)
          .where(eq(boards.id, board.id as string))
          .limit(1);
        if (!current[0]) throw new Error(`Board not found: ${board.id as string}`);
        throw boardVersionConflict(current[0].version);
      }
      await recordEvent(tx, result.event);
    });
  }

  /**
   * Read one board, compute the change, compare-and-set it. `apply` checks
   * `expectedVersion` and motor planning against the board it was given.
   */
  async function mutateBoard<T extends BoardUpdateResult>(
    boardId: string,
    apply: (map: Record<string, Board>) => T | Promise<T>,
    retryOnConflict: boolean,
  ): Promise<T> {
    const attempts = retryOnConflict ? UNVERSIONED_WRITE_ATTEMPTS : 1;
    for (let attempt = 1; ; attempt += 1) {
      const map = await loadOne(boardId);
      const previousVersion = map[boardId]?.version;
      const result = await apply(map);
      try {
        await commitBoardChange(previousVersion as number, result);
        return result;
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 409 && attempt < attempts) continue;
        throw err;
      }
    }
  }

  /** The voxa#16 read rule (`canAccessBoard`) as a SQL predicate. */
  function accessibleBy({ userId, role, orgId }: BoardActor): SQL {
    const clauses: SQL[] = [eq(boards.id, DEMO_BOARD_ID), eq(boards.ownerUserId, userId)];
    if ((role === 'editor' || role === 'admin') && orgId) {
      clauses.push(eq(boards.orgId, orgId));
    }
    return or(...clauses) as SQL;
  }

  return {
    async listBoardsForActor(actor: BoardActor) {
      const rows = await db.select().from(boards).where(accessibleBy(actor));
      return rows.map(rowToBoard);
    },

    async countBoardsOwnedBy(userId: string) {
      const rows = await db
        .select({ value: count() })
        .from(boards)
        .where(eq(boards.ownerUserId, userId));
      return Number(rows[0]?.value ?? 0);
    },

    async getBoard(boardId: string) {
      const rows = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
      return rows[0] ? rowToBoard(rows[0]) : undefined;
    },

    async createBoard(board: Board, actorUserId: string): Promise<BoardUpdateResult> {
      const id = board.id as string;
      const result = applyCreateBoard(await loadOne(id), board, actorUserId);
      const stored = result.board;
      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(boards)
          .values({
            id: stored.id as string,
            ownerUserId: stored.ownerUserId ?? null,
            orgId: stored.orgId ?? null,
            ...contentColumns(stored),
          })
          .onConflictDoNothing({ target: boards.id })
          .returning({ id: boards.id });
        // Lost a race with another create of the same id.
        if (inserted.length === 0) throw new Error(`Board already exists: ${id}`);
        await recordEvent(tx, result.event);
      });
      return result;
    },

    async updateBoard(boardId, next, actorUserId, options) {
      return mutateBoard(
        boardId,
        (map) => applyUpdateBoard(map, boardId, next, actorUserId, options),
        options?.expectedVersion === undefined,
      );
    },

    async exportObfBoard(boardId: string) {
      return exportBoardObf(await loadOne(boardId), boardId);
    },

    async exportObzBoard(boardId: string) {
      return exportBoardObz(await loadOne(boardId), boardId);
    },

    async deleteBoard(boardId: string, actorUserId: string, role: TeamRole, actorOrgId?: string) {
      const board = await this.getBoard(boardId);
      if (!board) throw new Error(`Board not found: ${boardId}`);
      if (!canEditBoard(boardId, board.ownerUserId, actorUserId, role, board.orgId, actorOrgId)) {
        const err = new Error('Forbidden');
        (err as Error & { status: number }).status = 403;
        throw err;
      }
      if (boardId === DEMO_BOARD_ID) {
        throw new Error('The demo board cannot be deleted');
      }
      await db.delete(boards).where(eq(boards.id, boardId));
    },

    async appendSyncEvents(events: SyncEvent[]) {
      assertSyncEventBatch(events);
      if (events.length === 0) return;
      await db.transaction(async (tx) => {
        for (const event of events) await insertEvent(tx, event);
        const boardIds = new Set(events.map((event) => event.boardId as string));
        for (const boardId of boardIds) await trimBoardEvents(tx, boardId);
      });
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
      const demo = createDemoBoard();
      // Idempotent across replicas starting at once.
      await db
        .insert(boards)
        .values({
          id: demo.id as string,
          ownerUserId: demo.ownerUserId ?? null,
          orgId: demo.orgId ?? null,
          ...contentColumns(demo),
        })
        .onConflictDoNothing({ target: boards.id });
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
      await this.ensureSeeded!();
    },
  };
}
