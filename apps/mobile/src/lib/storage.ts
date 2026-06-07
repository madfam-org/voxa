import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Board } from '@voxa/core';

export const BOARD_CACHE_KEY = 'voxa-board-cache';
export const PENDING_SAVE_KEY = 'voxa-pending-board-save';
export const SETTINGS_KEY = 'voxa-mobile-settings';

export async function cacheBoard(board: Board): Promise<void> {
  await AsyncStorage.setItem(BOARD_CACHE_KEY, JSON.stringify(board));
}

export async function loadCachedBoard(): Promise<Board | null> {
  try {
    const raw = await AsyncStorage.getItem(BOARD_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Board) : null;
  } catch {
    return null;
  }
}

export async function queuePendingSave(board: Board): Promise<void> {
  await AsyncStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(board));
}

export async function loadPendingSave(): Promise<Board | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_SAVE_KEY);
    return raw ? (JSON.parse(raw) as Board) : null;
  } catch {
    return null;
  }
}

export async function clearPendingSave(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_SAVE_KEY);
}
