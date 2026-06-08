import type { Board } from '@voxa/core';
import { idbDelete, idbGet, idbSet } from '@/lib/offline-idb';
import { PENDING_SAVE_KEY } from '@/lib/communicator-settings';

function legacyKey(boardId: string): string {
  return `${PENDING_SAVE_KEY}:${boardId}`;
}

function idbKey(boardId: string): string {
  return `pending-board:${boardId}`;
}

async function writePending(boardId: string, json: string): Promise<void> {
  try {
    await idbSet(idbKey(boardId), json);
  } catch {
    /* IDB unavailable */
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(legacyKey(boardId), json);
  }
}

export async function queuePendingBoardSave(boardId: string, board: Board): Promise<void> {
  const json = JSON.stringify(board);
  await writePending(boardId, json);
}

export function queuePendingBoardSaveSync(boardId: string, board: Board): void {
  const json = JSON.stringify(board);
  void writePending(boardId, json);
}

export async function loadPendingBoardSave(boardId: string): Promise<Board | null> {
  try {
    const fromIdb = await idbGet(idbKey(boardId));
    if (fromIdb) return JSON.parse(fromIdb) as Board;
  } catch {
    /* fall through */
  }

  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(legacyKey(boardId));
    return raw ? (JSON.parse(raw) as Board) : null;
  } catch {
    return null;
  }
}

export async function clearPendingBoardSave(boardId: string): Promise<void> {
  try {
    await idbDelete(idbKey(boardId));
  } catch {
    /* ignore */
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(legacyKey(boardId));
  }
}

export async function hasPendingBoardSave(boardId: string): Promise<boolean> {
  return Boolean(await loadPendingBoardSave(boardId));
}
