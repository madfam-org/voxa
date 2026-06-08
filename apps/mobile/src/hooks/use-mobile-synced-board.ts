import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDemoBoard, DEMO_BOARD_ID, type Board } from '@voxa/core';
import { createVoxaClient } from '@voxa/sync';
import {
  cacheBoard,
  clearPendingSave,
  loadCachedBoard,
  loadPendingSave,
  queuePendingSave,
} from '@/lib/storage';
import { API_URL } from '@/lib/board-utils';

function boardCacheKey(boardId: string): string {
  return `voxa:board:${boardId}`;
}

export function useMobileSyncedBoard() {
  const [boardId, setBoardIdState] = useState<string>(DEMO_BOARD_ID);
  const [board, setBoardState] = useState<Board>(() => createDemoBoard());
  const [syncStatus, setSyncStatus] = useState<'offline' | 'connecting' | 'live'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  const client = useMemo(
    () => createVoxaClient({ baseUrl: API_URL, userId: 'mobile-user', role: 'communicator' }),
    [],
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

  const setBoardId = useCallback(
    async (nextId: string) => {
      setBoardIdState(nextId);
      setSyncStatus('connecting');
      try {
        const loaded = await client.getBoard(nextId);
        setBoardState(loaded);
        await cacheBoard(loaded, nextId);
        setError(null);
      } catch {
        const cached = await loadCachedBoard(nextId);
        setBoardState(cached ?? createDemoBoard());
        setSyncStatus('offline');
        setError(cached ? 'Offline — cached board' : 'Could not load linked board');
      }
    },
    [client],
  );

  const flushPendingSave = useCallback(async () => {
    const pending = await loadPendingSave(boardId);
    if (!pending) return;
    try {
      const result = await client.saveBoard(pending, pending.version);
      setBoard(result.board);
      await clearPendingSave(boardId);
      setPendingSave(false);
    } catch {
      setPendingSave(true);
    }
  }, [boardId, client, setBoard]);

  useEffect(() => {
    let cancelled = false;
    let disconnect: (() => void) | undefined;

    (async () => {
      setSyncStatus('connecting');
      try {
        const loaded = await client.getBoard(boardId);
        if (cancelled) return;
        setBoardState(loaded);
        await cacheBoard(loaded, boardId);
        setError(null);
        await flushPendingSave();
      } catch {
        if (cancelled) return;
        const cached = await loadCachedBoard(boardId);
        setBoardState(cached ?? createDemoBoard());
        setSyncStatus('offline');
        setError(cached ? 'Offline — cached board' : 'Offline — demo board');
        setPendingSave(Boolean(await loadPendingSave(boardId)));
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
  }, [boardId, client, flushPendingSave]);

  return { board, boardId, syncStatus, error, pendingSave, setBoard, setBoardId };
}
