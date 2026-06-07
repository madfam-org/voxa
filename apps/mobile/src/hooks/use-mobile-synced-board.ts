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

export function useMobileSyncedBoard() {
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

  const setBoard = useCallback((next: Board | ((prev: Board) => Board)) => {
    setBoardState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      void cacheBoard(resolved);
      return resolved;
    });
  }, []);

  const flushPendingSave = useCallback(async () => {
    const pending = await loadPendingSave();
    if (!pending) return;
    try {
      const result = await client.saveBoard(pending, pending.version);
      setBoard(result.board);
      await clearPendingSave();
      setPendingSave(false);
    } catch {
      setPendingSave(true);
    }
  }, [client, setBoard]);

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
        const cached = await loadCachedBoard();
        setBoard(cached ?? createDemoBoard());
        setSyncStatus('offline');
        setError(cached ? 'Offline — cached board' : 'Offline — demo board');
        setPendingSave(Boolean(await loadPendingSave()));
        return;
      }

      disconnect = client.connectBoardSync(
        DEMO_BOARD_ID,
        async () => {
          try {
            const fresh = await client.getBoard(DEMO_BOARD_ID);
            setBoard(fresh);
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
  }, [client, flushPendingSave, setBoard]);

  return { board, syncStatus, error, pendingSave, setBoard };
}
