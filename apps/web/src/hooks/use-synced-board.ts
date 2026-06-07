'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDemoBoard, DEMO_BOARD_ID, type Board, type SyncEvent, type TeamRole } from '@voxa/core';
import { createVoxaClient } from '@voxa/sync';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function useSyncedBoard(role: TeamRole) {
  const [board, setBoard] = useState<Board>(() => createDemoBoard());
  const [syncStatus, setSyncStatus] = useState<'offline' | 'connecting' | 'live'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const boardRef = useRef(board);
  boardRef.current = board;

  const client = useMemo(
    () => createVoxaClient({ baseUrl: API_URL, userId: 'web-user', role }),
    [role],
  );

  const reload = useCallback(async () => {
    try {
      const loaded = await client.getBoard(DEMO_BOARD_ID);
      setBoard(loaded);
      setError(null);
    } catch {
      setBoard(createDemoBoard());
      setSyncStatus('offline');
      setError('API unreachable — using local demo board');
    }
  }, [client]);

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
      } catch {
        if (cancelled) return;
        setBoard(createDemoBoard());
        setSyncStatus('offline');
        setError('API unreachable — using local demo board');
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
              /* keep current board */
            }
          }
        },
        (status) => setSyncStatus(status === 'connected' ? 'live' : 'offline'),
      );
    })();

    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [client]);

  const saveBoard = useCallback(async () => {
    const result = await client.saveBoard(boardRef.current, boardRef.current.version);
    setBoard(result.board);
    return result;
  }, [client]);

  const importObf = useCallback(
    async (raw: string) => {
      const result = await client.importObf(DEMO_BOARD_ID, raw);
      setBoard(result.board);
      setWarnings(result.warnings);
      return result;
    },
    [client],
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
    reload,
    saveBoard,
    importObf,
    exportObf,
    isEditor: role === 'editor' || role === 'admin',
  };
}
