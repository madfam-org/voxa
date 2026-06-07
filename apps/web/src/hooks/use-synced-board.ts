'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDemoBoard, DEMO_BOARD_ID, type Board, type SyncEvent, type TeamRole } from '@voxa/core';
import { createVoxaClient } from '@voxa/sync';
import { BOARD_CACHE_KEY, PENDING_SAVE_KEY } from '@/lib/communicator-settings';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function cacheBoard(board: Board): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BOARD_CACHE_KEY, JSON.stringify(board));
}

function loadCachedBoard(): Board | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BOARD_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Board) : null;
  } catch {
    return null;
  }
}

function queuePendingSave(board: Board): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(board));
}

function loadPendingSave(): Board | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_SAVE_KEY);
    return raw ? (JSON.parse(raw) as Board) : null;
  } catch {
    return null;
  }
}

function clearPendingSave(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PENDING_SAVE_KEY);
}

export function useSyncedBoard(role: TeamRole) {
  const [board, setBoardState] = useState<Board>(() => createDemoBoard());
  const [syncStatus, setSyncStatus] = useState<'offline' | 'connecting' | 'live'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pendingSave, setPendingSave] = useState(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  const setBoard = useCallback((next: Board | ((prev: Board) => Board)) => {
    setBoardState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      cacheBoard(resolved);
      return resolved;
    });
  }, []);

  const client = useMemo(
    () => createVoxaClient({ baseUrl: API_URL, userId: 'web-user', role }),
    [role],
  );

  const flushPendingSave = useCallback(async () => {
    const pending = loadPendingSave();
    if (!pending) return;

    try {
      const result = await client.saveBoard(pending, pending.version);
      setBoard(result.board);
      clearPendingSave();
      setPendingSave(false);
      setError(null);
    } catch {
      setPendingSave(true);
    }
  }, [client, setBoard]);

  const reload = useCallback(async () => {
    try {
      const loaded = await client.getBoard(DEMO_BOARD_ID);
      setBoard(loaded);
      setError(null);
      await flushPendingSave();
    } catch {
      const cached = loadCachedBoard();
      setBoard(cached ?? createDemoBoard());
      setSyncStatus('offline');
      setError(cached ? 'Offline — using cached board' : 'API unreachable — using local demo board');
      setPendingSave(Boolean(loadPendingSave()));
    }
  }, [client, flushPendingSave, setBoard]);

  useEffect(() => {
    let cancelled = false;
    let disconnect: (() => void) | undefined;

    (async () => {
      setSyncStatus('connecting');
      try {
        const loaded = await client.getBoard(DEMO_BOARD_ID);
        if (cancelled) return;
        setBoard(loaded);
        setError(null);
        await flushPendingSave();
      } catch {
        if (cancelled) return;
        const cached = loadCachedBoard();
        setBoard(cached ?? createDemoBoard());
        setSyncStatus('offline');
        setError(
          cached ? 'Offline — using cached board' : 'API unreachable — using local demo board',
        );
        setPendingSave(Boolean(loadPendingSave()));
        return;
      }

      disconnect = client.connectBoardSync(
        DEMO_BOARD_ID,
        async (event: SyncEvent) => {
          if (event.type === 'board.updated' || event.type === 'board.created') {
            try {
              const fresh = await client.getBoard(DEMO_BOARD_ID);
              setBoard(fresh);
            } catch {
              /* keep cached board */
            }
          }
        },
        (status) => {
          const live = status === 'connected';
          setSyncStatus(live ? 'live' : 'offline');
          if (live) void flushPendingSave();
        },
      );
    })();

    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [client, flushPendingSave, setBoard]);

  const saveBoard = useCallback(async () => {
    try {
      const result = await client.saveBoard(boardRef.current, boardRef.current.version);
      setBoard(result.board);
      clearPendingSave();
      setPendingSave(false);
      return result;
    } catch {
      queuePendingSave(boardRef.current);
      setPendingSave(true);
      throw new Error('Save queued — will sync when back online');
    }
  }, [client, setBoard]);

  const importObf = useCallback(
    async (raw: string) => {
      try {
        const result = await client.importObf(DEMO_BOARD_ID, raw);
        setBoard(result.board);
        setWarnings(result.warnings);
        return result;
      } catch (err) {
        throw err;
      }
    },
    [client, setBoard],
  );

  const exportObf = useCallback(async () => {
    return client.exportObf(DEMO_BOARD_ID);
  }, [client]);

  return {
    board,
    setBoard,
    syncStatus,
    error,
    warnings,
    pendingSave,
    reload,
    saveBoard,
    importObf,
    exportObf,
    isEditor: role === 'editor' || role === 'admin',
  };
}
