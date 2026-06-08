import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Board } from '@voxa/core';

export const BOARD_CACHE_KEY = 'voxa-board-cache';
export const PENDING_SAVE_KEY = 'voxa-pending-board-save';
export const SETTINGS_KEY = 'voxa-mobile-settings';
export const SELECTED_BOARD_KEY = 'voxa-selected-board-id';

function cacheKey(boardId?: string): string {
  return boardId ? `${BOARD_CACHE_KEY}:${boardId}` : BOARD_CACHE_KEY;
}

function pendingKey(boardId?: string): string {
  return boardId ? `${PENDING_SAVE_KEY}:${boardId}` : PENDING_SAVE_KEY;
}

export async function cacheBoard(board: Board, boardId?: string): Promise<void> {
  await AsyncStorage.setItem(cacheKey(boardId ?? (board.id as string)), JSON.stringify(board));
}

export async function loadCachedBoard(boardId?: string): Promise<Board | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(boardId));
    return raw ? (JSON.parse(raw) as Board) : null;
  } catch {
    return null;
  }
}

export async function queuePendingSave(board: Board, boardId?: string): Promise<void> {
  await AsyncStorage.setItem(pendingKey(boardId ?? (board.id as string)), JSON.stringify(board));
}

export async function loadPendingSave(boardId?: string): Promise<Board | null> {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(boardId));
    return raw ? (JSON.parse(raw) as Board) : null;
  } catch {
    return null;
  }
}

export async function clearPendingSave(boardId?: string): Promise<void> {
  await AsyncStorage.removeItem(pendingKey(boardId));
}

export async function hasPendingSave(boardId?: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(pendingKey(boardId));
  return Boolean(raw);
}

export async function loadSelectedBoardId(): Promise<string> {
  const raw = await AsyncStorage.getItem(SELECTED_BOARD_KEY);
  return raw || 'demo-core';
}

export async function saveSelectedBoardId(boardId: string): Promise<void> {
  await AsyncStorage.setItem(SELECTED_BOARD_KEY, boardId);
}
