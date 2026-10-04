import type { Board } from '@voxa/core';
import { idbDelete, idbGet, idbSet } from '@/lib/offline-idb';
import { PENDING_SAVE_KEY } from '@/lib/communicator-settings';

/**
 * Offline board saves, queued until the API answers again.
 *
 * Every queued save carries the id of the account that made it. A save is only
 * ever sent for that account: when another account (or nobody) is signed in,
 * it is deleted unsent and the caller shows a notice. On a shared tablet this
 * is what keeps one caregiver's offline edits from being written to the API
 * under the next person's session. Saves queued before ownership was recorded
 * have no owner and are dropped the same way.
 */
interface PendingEnvelope {
  ownerUserId: string;
  board: Board;
}

export type PendingBoardSave =
  | { status: 'none' }
  | { status: 'ready'; board: Board }
  | { status: 'dropped' };

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

function envelope(ownerUserId: string, board: Board): string {
  return JSON.stringify({ ownerUserId, board } satisfies PendingEnvelope);
}

export async function queuePendingBoardSave(
  boardId: string,
  board: Board,
  ownerUserId: string,
): Promise<void> {
  await writePending(boardId, envelope(ownerUserId, board));
}

export function queuePendingBoardSaveSync(boardId: string, board: Board, ownerUserId: string): void {
  void writePending(boardId, envelope(ownerUserId, board));
}

async function readRaw(boardId: string): Promise<string | null> {
  try {
    const fromIdb = await idbGet(idbKey(boardId));
    if (fromIdb) return fromIdb;
  } catch {
    /* fall through */
  }
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(legacyKey(boardId));
  } catch {
    return null;
  }
}

function parseEnvelope(raw: string): PendingEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PendingEnvelope> | null;
    if (
      parsed &&
      typeof parsed.ownerUserId === 'string' &&
      parsed.ownerUserId &&
      parsed.board &&
      typeof parsed.board === 'object'
    ) {
      return { ownerUserId: parsed.ownerUserId, board: parsed.board };
    }
  } catch {
    /* unreadable: treated as unowned */
  }
  return null;
}

/**
 * The queued save for this board, if it belongs to `currentUserId`. A save
 * owned by anyone else, or by no recorded account, is deleted here and
 * reported as `dropped`; it is never returned for sending.
 */
export async function loadPendingBoardSave(
  boardId: string,
  currentUserId: string | null,
): Promise<PendingBoardSave> {
  const raw = await readRaw(boardId);
  if (!raw) return { status: 'none' };
  const pending = parseEnvelope(raw);
  if (!pending || !currentUserId || pending.ownerUserId !== currentUserId) {
    await clearPendingBoardSave(boardId);
    return { status: 'dropped' };
  }
  return { status: 'ready', board: pending.board };
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

/** Whether a save for this account is waiting (others' saves are dropped, not counted). */
export async function hasPendingBoardSave(
  boardId: string,
  currentUserId: string | null,
): Promise<boolean> {
  return (await loadPendingBoardSave(boardId, currentUserId)).status === 'ready';
}
