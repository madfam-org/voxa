import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { createDemoBoard, DEMO_BOARD_ID, type Board } from '@voxa/core';
import { createVoxaClient } from '@voxa/sync';
import {
  cacheBoard,
  clearPendingSave,
  loadCachedBoard,
  loadPendingSave,
  loadSelectedBoardId,
  queuePendingSave,
  saveSelectedBoardId,
} from '@/lib/storage';
import { API_URL } from '@/lib/board-utils';

export interface BoardSummary {
  id: string;
  name: string;
}

interface UseMobileSyncedBoardOptions {
  accessToken?: string;
  userId?: string;
}

export function useMobileSyncedBoard(options: UseMobileSyncedBoardOptions = {}) {
  const [boardId, setBoardIdState] = useState<string>(DEMO_BOARD_ID);
  const [boardCatalog, setBoardCatalog] = useState<BoardSummary[]>([]);
  const [board, setBoardState] = useState<Board>(() => createDemoBoard());
  const [syncStatus, setSyncStatus] = useState<'offline' | 'connecting' | 'live'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  const client = useMemo(
    () =>
      createVoxaClient({
        baseUrl: API_URL,
        userId: options.userId ?? 'mobile-user',
        role: 'communicator',
        accessToken: options.accessToken,
      }),
    [options.accessToken, options.userId],
  );

  const setBoard = useCallback(
    (next: Board | ((prev: Board) => Board)) => {
      setBoardState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        void cacheBoard(resolved, boardId);
        return resolved;
      });
    },
    [boardId],
  );

  const refreshPendingFlag = useCallback(async () => {
    setPendingSave(Boolean(await loadPendingSave(boardId)));
  }, [boardId]);

  const flushPendingSave = useCallback(async () => {
    const pending = await loadPendingSave(boardId);
    if (!pending) {
      setPendingSave(false);
      setSyncError(null);
      return;
    }

    try {
      const result = await client.saveBoard(pending, pending.version);
      setBoard(result.board);
      await clearPendingSave(boardId);
      setPendingSave(false);
      setSyncError(null);
    } catch (err) {
      setPendingSave(true);
      setSyncError((err as Error).message);
    }
  }, [boardId, client, setBoard]);

  const setBoardId = useCallback(
    async (nextId: string) => {
      setBoardIdState(nextId);
      await saveSelectedBoardId(nextId);
      setSyncStatus('connecting');

      const cached = await loadCachedBoard(nextId);
      if (cached) {
        setBoardState(cached);
      }

      try {
        const loaded = await client.getBoard(nextId);
        setBoardState(loaded);
        await cacheBoard(loaded, nextId);
        setSyncStatus('live');
        setError(null);
        await flushPendingSave();
      } catch {
        setSyncStatus('offline');
        setError(
          cached ? 'Offline — using cached board' : 'Could not load board — using demo',
        );
        if (!cached) setBoardState(createDemoBoard());
        await refreshPendingFlag();
      }
    },
    [client, flushPendingSave, refreshPendingFlag],
  );

  useEffect(() => {
    void (async () => {
      const selectedId = await loadSelectedBoardId();
      const cached = await loadCachedBoard(selectedId);
      if (cached) setBoardState(cached);
      setBoardIdState(selectedId);
      setPendingSave(Boolean(await loadPendingSave(selectedId)));
      setBootstrapped(true);
    })();
  }, []);

  useEffect(() => {
    if (!options.accessToken) {
      setBoardCatalog([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const boards = await client.listBoards();
        if (cancelled) return;
        setBoardCatalog(boards.map((item) => ({ id: item.id as string, name: item.name })));
      } catch {
        if (!cancelled) setBoardCatalog([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, options.accessToken]);

  useEffect(() => {
    if (!bootstrapped) return;

    let cancelled = false;
    let disconnect: (() => void) | undefined;

    void (async () => {
      setSyncStatus('connecting');
      try {
        const loaded = await client.getBoard(boardId);
        if (cancelled) return;
        setBoardState(loaded);
        await cacheBoard(loaded, boardId);
        setSyncStatus('live');
        setError(null);
        await flushPendingSave();
      } catch {
        if (cancelled) return;
        const cached = await loadCachedBoard(boardId);
        if (cached) setBoardState(cached);
        setSyncStatus('offline');
        setError(cached ? 'Offline — cached board' : 'Offline — demo board');
        if (!cached) setBoardState(createDemoBoard());
        await refreshPendingFlag();
        return;
      }

      disconnect = client.connectBoardSync(
        boardId,
        async () => {
          try {
            const fresh = await client.getBoard(boardId);
            setBoardState(fresh);
            await cacheBoard(fresh, boardId);
          } catch {
            /* keep cache */
          }
        },
        (status) => {
          setSyncStatus(status === 'connected' ? 'live' : 'offline');
          if (status === 'connected') void flushPendingSave();
        },
      );
    })();

    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [boardId, bootstrapped, client, flushPendingSave, refreshPendingFlag]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void flushPendingSave();
    });
    return unsubscribe;
  }, [flushPendingSave]);

  return {
    board,
    boardId,
    boardCatalog,
    syncStatus,
    error,
    pendingSave,
    syncError,
    setBoard,
    setBoardId,
    retryPendingSave: flushPendingSave,
  };
}
