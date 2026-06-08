import { randomUUID } from 'node:crypto';
import {
  createBoardId,
  type Board,
  type BoardUpdateResult,
  type SyncEvent,
} from '@voxa/core';
import { findMotorPlanningViolations } from '@voxa/vocabulary';
import { obfToVoxaButtons, obzToVoxaButtons, parseObfJson, unpackObz, voxaBoardToObf, voxaBoardToObz } from '@voxa/obf';
import type { ImportObfResult } from './types.js';

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

  const stored: Board = {
    ...next,
    id: createBoardId(boardId),
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  };
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

  return { ...result, warnings: unpacked.warnings };
}

export async function exportBoardObz(boards: Record<string, Board>, boardId: string): Promise<Uint8Array> {
  const board = boards[boardId];
  if (!board) {
    throw new Error(`Board not found: ${boardId}`);
  }
  return voxaBoardToObz(board);
}

export function exportBoardObf(boards: Record<string, Board>, boardId: string): string {
  const board = boards[boardId];
  if (!board) {
    throw new Error(`Board not found: ${boardId}`);
  }
  return JSON.stringify(voxaBoardToObf(board), null, 2);
}

export function trimSyncEvents(events: SyncEvent[], max = 5000): SyncEvent[] {
  if (events.length <= max) return events;
  return events.slice(-max);
}
