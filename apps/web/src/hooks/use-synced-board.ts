'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createBoardId,
  createButtonId,
  createDemoBoard,
  createProfileId,
  DEMO_BOARD_ID,
  type Board,
  type BoardUpdateResult,
  type SyncEvent,
  type TeamRole,
} from '@voxa/core';
import { createVoxaClient, isVersionConflictError } from '@voxa/sync';
import { exportBoardObfJson } from '@/lib/local-obf-export';
import { BOARD_CACHE_KEY, SELECTED_BOARD_KEY } from '@/lib/communicator-settings';
import { registerBackgroundSync } from '@/lib/offline-idb';
import {
  clearPendingBoardSave,
  hasPendingBoardSave,
  loadPendingBoardSave,
  queuePendingBoardSave,
  queuePendingBoardSaveSync,
} from '@/lib/pending-board-save';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface BoardSummary {
  id: string;
  name: string;
}

function boardCacheKey(boardId: string): string {
  return `${BOARD_CACHE_KEY}:${boardId}`;
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

function loadSelectedBoardId(): string {
  if (typeof window === 'undefined') return DEMO_BOARD_ID;
  return localStorage.getItem(SELECTED_BOARD_KEY) || DEMO_BOARD_ID;
}

export type SaveBoardResult = BoardUpdateResult | { conflict: true };

export function useSyncedBoard(role: TeamRole) {
  const [boardId, setBoardIdState] = useState<string>(DEMO_BOARD_ID);
  const [boardCatalog, setBoardCatalog] = useState<BoardSummary[]>([]);
  const [board, setBoardState] = useState<Board>(() => createDemoBoard());
  const [syncStatus, setSyncStatus] = useState<'offline' | 'connecting' | 'live'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pendingSave, setPendingSave] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [conflictRefreshed, setConflictRefreshed] = useState(false);
  const boardRef = useRef(board);
  boardRef.current = board;
  const isEditor = role === 'editor' || role === 'admin';

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
  const [sessionTeamRole, setSessionTeamRole] = useState<TeamRole>('communicator');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (!res.ok) return;
        const body = (await res.json()) as {
          accessToken?: string;
          user?: { id?: string };
          teamRole?: TeamRole;
        };
        if (cancelled) return;
        if (body.accessToken) setAccessToken(body.accessToken);
        if (body.user?.id) setSessionUserId(body.user.id);
        if (body.teamRole) setSessionTeamRole(body.teamRole);
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

  const refreshPendingFlag = useCallback(async () => {
    setPendingSave(await hasPendingBoardSave(boardId));
  }, [boardId]);

  const applyVersionConflict = useCallback(async (fromManualSave = false) => {
    try {
      const fresh = await client.getBoard(boardId);
      setBoard(fresh);
      await clearPendingBoardSave(boardId);
      setPendingSave(false);
      if (fromManualSave) {
        setConflictRefreshed(true);
        setSyncError(null);
      } else {
        setSyncError(
          'Another editor saved changes first — your board was refreshed to the latest version.',
        );
      }
    } catch {
      setSyncError('Version conflict — reload the page and try again.');
    }
  }, [boardId, client, setBoard]);

  const clearConflictNotice = useCallback(() => {
    setConflictRefreshed(false);
  }, []);

  const flushPendingSave = useCallback(async () => {
    const pending = await loadPendingBoardSave(boardId);
    if (!pending) {
      setPendingSave(false);
      setSyncError(null);
      return;
    }

    try {
      const result = await client.saveBoard(pending, pending.version);
      setBoard(result.board);
      await clearPendingBoardSave(boardId);
      setPendingSave(false);
      setSyncError(null);
      setError(null);
    } catch (err) {
      if (isVersionConflictError(err)) {
        await applyVersionConflict();
        return;
      }
      setPendingSave(true);
      setSyncError((err as Error).message);
    }
  }, [applyVersionConflict, boardId, client, setBoard]);

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
      await refreshPendingFlag();
    }
  }, [boardId, client, flushPendingSave, refreshPendingFlag, setBoard]);

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
        await refreshPendingFlag();
        return;
      }

      disconnect = client.connectBoardSync(
        boardId,
        async (event: SyncEvent) => {
          if (event.actorUserId === sessionUserId) return;
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
  }, [boardId, client, flushPendingSave, refreshPendingFlag, setBoard]);

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

  useEffect(() => {
    if (!isEditor || !accessToken) return;
    if (syncStatus === 'live' && !pendingSave) return;

    const timer = window.setTimeout(() => {
      queuePendingBoardSaveSync(boardId, boardRef.current);
      setPendingSave(true);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [accessToken, board, boardId, isEditor, pendingSave, syncStatus]);

  const saveBoard = useCallback(async (): Promise<SaveBoardResult> => {
    try {
      const result = await client.saveBoard(boardRef.current, boardRef.current.version);
      setBoard(result.board);
      await clearPendingBoardSave(boardId);
      setPendingSave(false);
      setSyncError(null);
      setConflictRefreshed(false);
      return result;
    } catch (err) {
      if (isVersionConflictError(err)) {
        await applyVersionConflict(true);
        return { conflict: true };
      }
      await queuePendingBoardSave(boardId, boardRef.current);
      setPendingSave(true);
      void registerBackgroundSync();
      throw new Error('Save queued — will sync when back online');
    }
  }, [applyVersionConflict, boardId, client, setBoard]);

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
    try {
      return await client.exportObf(boardId);
    } catch {
      return exportBoardObfJson(boardRef.current);
    }
  }, [boardId, client]);

  const importObz = useCallback(
    async (archive: ArrayBuffer) => {
      const result = await client.importObz(boardId, archive);
      setBoard(result.board);
      setWarnings(result.warnings);
      return result;
    },
    [boardId, client, setBoard],
  );

  const exportObz = useCallback(async () => {
    return client.exportObz(boardId);
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

  const renameBoard = useCallback(
    async (name: string) => {
      const result = await client.saveBoard(
        { ...boardRef.current, name },
        boardRef.current.version,
      );
      setBoard(result.board);
      setBoardCatalog((prev) =>
        prev.map((item) => (item.id === boardId ? { ...item, name: result.board.name } : item)),
      );
      return result.board;
    },
    [boardId, client, setBoard],
  );

  const duplicateBoard = useCallback(async () => {
    const id = `board-${Date.now()}`;
    const source = boardRef.current;
    const template: Board = {
      ...source,
      id: createBoardId(id),
      name: `${source.name} copy`,
      version: 1,
      updatedAt: new Date().toISOString(),
      grid: {
        rows: source.grid.rows,
        columns: source.grid.columns,
        buttons: source.grid.buttons.map((btn, index) => ({
          ...btn,
          id: createButtonId(`${btn.id as string}-dup-${index}-${Date.now()}`),
        })),
      },
    };
    const result = await client.createBoard(template);
    const summary = { id: result.board.id as string, name: result.board.name };
    setBoardCatalog((prev) => [...prev.filter((b) => b.id !== summary.id), summary]);
    setBoardId(summary.id);
    setBoard(result.board);
    return result.board;
  }, [client, setBoard, setBoardId]);

  const deleteBoard = useCallback(async () => {
    await client.deleteBoard(boardId);
    setBoardCatalog((prev) => prev.filter((item) => item.id !== boardId));
    setBoardId(DEMO_BOARD_ID);
  }, [boardId, client, setBoardId]);

  return {
    board,
    boardId,
    boardCatalog,
    setBoardId,
    createBoard,
    renameBoard,
    duplicateBoard,
    deleteBoard,
    setBoard,
    syncStatus,
    error,
    warnings,
    pendingSave,
    syncError,
    conflictRefreshed,
    clearConflictNotice,
    reload,
    retryPendingSave: flushPendingSave,
    saveBoard,
    importObf,
    exportObf,
    importObz,
    exportObz,
    isEditor,
    isAuthenticated: Boolean(accessToken),
    accessToken,
    sessionUserId,
    sessionTeamRole,
  };
}
