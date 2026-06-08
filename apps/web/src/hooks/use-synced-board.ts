'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createBoardId,
  createDemoBoard,
  createProfileId,
  DEMO_BOARD_ID,
  type Board,
  type SyncEvent,
  type TeamRole,
} from '@voxa/core';
import { createVoxaClient } from '@voxa/sync';
import {
  BOARD_CACHE_KEY,
  PENDING_SAVE_KEY,
  SELECTED_BOARD_KEY,
} from '@/lib/communicator-settings';
import { registerBackgroundSync } from '@/lib/offline-idb';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface BoardSummary {
  id: string;
  name: string;
}

function boardCacheKey(boardId: string): string {
  return `${BOARD_CACHE_KEY}:${boardId}`;
}

function pendingSaveKey(boardId: string): string {
  return `${PENDING_SAVE_KEY}:${boardId}`;
}

function cacheBoard(boardId: string, board: Board): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(boardCacheKey(boardId), JSON.stringify(board));
}

function loadCachedBoard(boardId: string): Board | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(boardCacheKey(boardId));
    return raw ? (JSON.parse(raw) as Board) : null;
  } catch {
    return null;
  }
}

function queuePendingSave(boardId: string, board: Board): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(pendingSaveKey(boardId), JSON.stringify(board));
}

function loadPendingSave(boardId: string): Board | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(pendingSaveKey(boardId));
    return raw ? (JSON.parse(raw) as Board) : null;
  } catch {
    return null;
  }
}

function clearPendingSave(boardId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(pendingSaveKey(boardId));
}

function loadSelectedBoardId(): string {
  if (typeof window === 'undefined') return DEMO_BOARD_ID;
  return localStorage.getItem(SELECTED_BOARD_KEY) || DEMO_BOARD_ID;
}

export function useSyncedBoard(role: TeamRole) {
  const [boardId, setBoardIdState] = useState<string>(DEMO_BOARD_ID);
  const [boardCatalog, setBoardCatalog] = useState<BoardSummary[]>([]);
  const [board, setBoardState] = useState<Board>(() => createDemoBoard());
  const [syncStatus, setSyncStatus] = useState<'offline' | 'connecting' | 'live'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pendingSave, setPendingSave] = useState(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  useEffect(() => {
    setBoardIdState(loadSelectedBoardId());
  }, []);

  const setBoardId = useCallback((nextId: string) => {
    setBoardIdState(nextId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SELECTED_BOARD_KEY, nextId);
    }
  }, []);

  const setBoard = useCallback(
    (next: Board | ((prev: Board) => Board)) => {
      setBoardState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        cacheBoard(boardId, resolved);
        return resolved;
      });
    },
    [boardId],
  );

  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [sessionUserId, setSessionUserId] = useState<string>('web-user');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (!res.ok) return;
        const body = (await res.json()) as {
          accessToken?: string;
          user?: { id?: string };
        };
        if (cancelled) return;
        if (body.accessToken) setAccessToken(body.accessToken);
        if (body.user?.id) setSessionUserId(body.user.id);
      } catch {
        /* unauthenticated or OIDC not configured */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const client = useMemo(
    () =>
      createVoxaClient({
        baseUrl: API_URL,
        userId: sessionUserId,
        role,
        accessToken,
      }),
    [accessToken, role, sessionUserId],
  );

  useEffect(() => {
    if (!accessToken) {
      setBoardCatalog([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const boards = await client.listBoards();
        if (cancelled) return;
        setBoardCatalog(
          boards.map((item) => ({ id: item.id as string, name: item.name })),
        );
      } catch {
        if (!cancelled) setBoardCatalog([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, client]);

  const flushPendingSave = useCallback(async () => {
    const pending = loadPendingSave(boardId);
    if (!pending) return;

    try {
      const result = await client.saveBoard(pending, pending.version);
      setBoard(result.board);
      clearPendingSave(boardId);
      setPendingSave(false);
      setError(null);
    } catch {
      setPendingSave(true);
    }
  }, [boardId, client, setBoard]);

  const reload = useCallback(async () => {
    try {
      const loaded = await client.getBoard(boardId);
      setBoard(loaded);
      setError(null);
      await flushPendingSave();
    } catch {
      const cached = loadCachedBoard(boardId);
      setBoard(cached ?? createDemoBoard());
      setSyncStatus('offline');
      setError(cached ? 'Offline — using cached board' : 'API unreachable — using local demo board');
      setPendingSave(Boolean(loadPendingSave(boardId)));
    }
  }, [boardId, client, flushPendingSave, setBoard]);

  useEffect(() => {
    let cancelled = false;
    let disconnect: (() => void) | undefined;

    (async () => {
      setSyncStatus('connecting');
      try {
        const loaded = await client.getBoard(boardId);
        if (cancelled) return;
        setBoard(loaded);
        setError(null);
        await flushPendingSave();
      } catch {
        if (cancelled) return;
        const cached = loadCachedBoard(boardId);
        setBoard(cached ?? createDemoBoard());
        setSyncStatus('offline');
        setError(
          cached ? 'Offline — using cached board' : 'API unreachable — using local demo board',
        );
        setPendingSave(Boolean(loadPendingSave(boardId)));
        return;
      }

      disconnect = client.connectBoardSync(
        boardId,
        async (event: SyncEvent) => {
          if (event.type === 'board.updated' || event.type === 'board.created') {
            try {
              const fresh = await client.getBoard(boardId);
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
  }, [boardId, client, flushPendingSave, setBoard]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'voxa:flush-pending-save') {
        void flushPendingSave();
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [flushPendingSave]);

  useEffect(() => {
    const onOnline = () => void flushPendingSave();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushPendingSave]);

  const saveBoard = useCallback(async () => {
    try {
      const result = await client.saveBoard(boardRef.current, boardRef.current.version);
      setBoard(result.board);
      clearPendingSave(boardId);
      setPendingSave(false);
      return result;
    } catch {
      queuePendingSave(boardId, boardRef.current);
      setPendingSave(true);
      void registerBackgroundSync();
      throw new Error('Save queued — will sync when back online');
    }
  }, [boardId, client, setBoard]);

  const importObf = useCallback(
    async (raw: string) => {
      const result = await client.importObf(boardId, raw);
      setBoard(result.board);
      setWarnings(result.warnings);
      return result;
    },
    [boardId, client, setBoard],
  );

  const exportObf = useCallback(async () => {
    return client.exportObf(boardId);
  }, [boardId, client]);

  const createBoard = useCallback(
    async (name: string) => {
      const id = `board-${Date.now()}`;
      const template: Board = {
        id: createBoardId(id),
        name,
        profileId: createProfileId('default'),
        version: 1,
        updatedAt: new Date().toISOString(),
        grid: { rows: 4, columns: 4, buttons: [] },
      };
      const result = await client.createBoard(template);
      const summary = { id: result.board.id as string, name: result.board.name };
      setBoardCatalog((prev) => [...prev.filter((b) => b.id !== summary.id), summary]);
      setBoardId(summary.id);
      setBoard(result.board);
      return result.board;
    },
    [client, setBoard, setBoardId],
  );

  return {
    board,
    boardId,
    boardCatalog,
    setBoardId,
    createBoard,
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
    isAuthenticated: Boolean(accessToken),
  };
}
