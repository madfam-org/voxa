import { randomUUID } from 'node:crypto';
import {
  createBoardId,
  DEMO_BOARD_ID,
  type Board,
  type BoardUpdateResult,
  type SyncEvent,
} from '@voxa/core';
import { findMotorPlanningViolations } from '@voxa/vocabulary';
import { gridsetArchiveToBoardUpdate, snapArchiveToBoardUpdate, touchChatArchiveToBoardUpdate } from '@voxa/import-adapters';
import { obfToVoxaButtons, obzToVoxaButtons, parseObfJson, unpackObz, voxaBoardToObf, voxaBoardToObz } from '@voxa/obf';
import type { ImportObfResult } from './types.js';
import { obzExportOptions, webBaseUrl } from '../lib/symbol-assets.js';

export function createSyncEvent(
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

export function applyCreateBoard(
  boards: Record<string, Board>,
  board: Board,
  actorUserId: string,
): BoardUpdateResult {
  const id = board.id as string;
  if (boards[id]) {
    throw new Error(`Board already exists: ${id}`);
  }

  const stored: Board = {
    ...board,
    ownerUserId: board.ownerUserId ?? actorUserId,
    updatedAt: new Date().toISOString(),
  };
  boards[id] = stored;
  const event = createSyncEvent('board.created', stored, actorUserId);
  return { board: stored, event };
}

export function applyUpdateBoard(
  boards: Record<string, Board>,
  boardId: string,
  next: Board,
  actorUserId: string,
  options?: { expectedVersion?: number; forceMotorPlanning?: boolean },
): BoardUpdateResult {
  const current = boards[boardId];
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

  // Owner and organization are never taken from the request body: an update
  // cannot transfer a board, and a client that omits them cannot wipe them.
  const { ownerUserId: _ignoredOwner, orgId: _ignoredOrg, ...content } = next;
  const stored: Board = {
    ...content,
    id: createBoardId(boardId),
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  };
  if (current.ownerUserId !== undefined) stored.ownerUserId = current.ownerUserId;
  if (current.orgId !== undefined) stored.orgId = current.orgId;
  boards[boardId] = stored;
  const event = createSyncEvent('board.updated', stored, actorUserId);
  return { board: stored, event };
}

export function applyImportObfBoard(
  boards: Record<string, Board>,
  boardId: string,
  rawObf: string,
  actorUserId: string,
): ImportObfResult {
  const current = boards[boardId];
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

  const result = applyUpdateBoard(boards, boardId, next, actorUserId, {
    expectedVersion: current.version,
    forceMotorPlanning: true,
  });
  result.event.payload = { action: 'import.obf' };

  return { ...result, warnings };
}

export function applyImportObzBoard(
  boards: Record<string, Board>,
  boardId: string,
  archive: Uint8Array,
  actorUserId: string,
): ImportObfResult {
  const current = boards[boardId];
  if (!current) {
    throw new Error(`Board not found: ${boardId}`);
  }

  const unpacked = unpackObz(archive);
  const buttons = obzToVoxaButtons(unpacked);

  const next: Board = {
    ...current,
    name: unpacked.board.name || current.name,
    grid: {
      rows: unpacked.board.grid.rows,
      columns: unpacked.board.grid.columns,
      buttons,
    },
  };

  const result = applyUpdateBoard(boards, boardId, next, actorUserId, {
    expectedVersion: current.version,
    forceMotorPlanning: true,
  });
  result.event.payload = { action: 'import.obz' };

  return { ...result, warnings: unpacked.warnings };
}

export function applyImportGridsetBoard(
  boards: Record<string, Board>,
  boardId: string,
  archive: Uint8Array,
  actorUserId: string,
): ImportObfResult {
  const current = boards[boardId];
  if (!current) {
    throw new Error(`Board not found: ${boardId}`);
  }

  const { page, buttons, warnings } = gridsetArchiveToBoardUpdate(archive, boardId);

  const next: Board = {
    ...current,
    name: page.name || current.name,
    grid: {
      rows: page.rows,
      columns: page.columns,
      buttons,
    },
  };

  const result = applyUpdateBoard(boards, boardId, next, actorUserId, {
    expectedVersion: current.version,
    forceMotorPlanning: true,
  });
  result.event.payload = { action: 'import.gridset' };

  return { ...result, warnings };
}

export async function applyImportSnapBoard(
  boards: Record<string, Board>,
  boardId: string,
  archive: Uint8Array,
  actorUserId: string,
): Promise<ImportObfResult> {
  const current = boards[boardId];
  if (!current) {
    throw new Error(`Board not found: ${boardId}`);
  }

  const { page, buttons, warnings } = await snapArchiveToBoardUpdate(archive, boardId);

  const next: Board = {
    ...current,
    name: page.name || current.name,
    grid: {
      rows: page.rows,
      columns: page.columns,
      buttons,
    },
  };

  const result = applyUpdateBoard(boards, boardId, next, actorUserId, {
    expectedVersion: current.version,
    forceMotorPlanning: true,
  });
  result.event.payload = { action: 'import.snap' };

  return { ...result, warnings };
}

export async function applyImportTouchChatBoard(
  boards: Record<string, Board>,
  boardId: string,
  archive: Uint8Array,
  actorUserId: string,
): Promise<ImportObfResult> {
  const current = boards[boardId];
  if (!current) {
    throw new Error(`Board not found: ${boardId}`);
  }

  const { page, buttons, warnings } = await touchChatArchiveToBoardUpdate(archive, boardId);

  const next: Board = {
    ...current,
    name: page.name || current.name,
    grid: {
      rows: page.rows,
      columns: page.columns,
      buttons,
    },
  };

  const result = applyUpdateBoard(boards, boardId, next, actorUserId, {
    expectedVersion: current.version,
    forceMotorPlanning: true,
  });
  result.event.payload = { action: 'import.touchchat' };

  return { ...result, warnings };
}

export async function exportBoardObz(boards: Record<string, Board>, boardId: string): Promise<Uint8Array> {
  const board = boards[boardId];
  if (!board) {
    throw new Error(`Board not found: ${boardId}`);
  }
  return voxaBoardToObz(board, obzExportOptions(boardId));
}

export function exportBoardObf(boards: Record<string, Board>, boardId: string): string {
  const board = boards[boardId];
  if (!board) {
    throw new Error(`Board not found: ${boardId}`);
  }
  return JSON.stringify(voxaBoardToObf(board, { assetBaseUrl: webBaseUrl() }), null, 2);
}

/** Sync/audit events kept per board; older ones are trimmed on write. */
export const MAX_SYNC_EVENTS_PER_BOARD = 5000;

/**
 * Keep the newest `max` events of `boardId` and every event of other boards.
 * Trimming is per board, so activity on one board never erases another
 * board's audit history.
 */
export function trimSyncEvents(
  events: SyncEvent[],
  boardId: string,
  max = MAX_SYNC_EVENTS_PER_BOARD,
): SyncEvent[] {
  let excess = events.filter((event) => event.boardId === boardId).length - max;
  if (excess <= 0) return events;
  return events.filter((event) => {
    if (excess > 0 && event.boardId === boardId) {
      excess -= 1;
      return false;
    }
    return true;
  });
}

export function applyDeleteBoard(
  boards: Record<string, Board>,
  boardId: string,
): void {
  if (boardId === DEMO_BOARD_ID) {
    throw new Error('The demo board cannot be deleted');
  }
  if (!boards[boardId]) {
    throw new Error(`Board not found: ${boardId}`);
  }
  delete boards[boardId];
}
