'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  createBoardId,
  createButtonId,
  createDemoBoard,
  createProfileId,
  DEMO_BOARD_ID,
  type Board,
  type BoardUpdateResult,
  type StarterTemplateId,
  type SyncEvent,
  type TeamRole,
} from '@voxa/core';
import { createVoxaClient, isVersionConflictError } from '@voxa/sync';
import { initialBoardId } from '@/lib/editor-access';
import { exportBoardObfJson } from '@/lib/local-obf-export';
import { BOARD_CACHE_KEY, SELECTED_BOARD_KEY } from '@/lib/communicator-settings';
import { registerBackgroundSync } from '@/lib/offline-idb';
import { classifySaveFailure } from '@/lib/save-errors';
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
  if (typeof window === 'undefined') return initialBoardId(null);
  return initialBoardId(localStorage.getItem(SELECTED_BOARD_KEY));
}

export type SaveBoardResult = BoardUpdateResult | { conflict: true };

export function useSyncedBoard(role: TeamRole) {
  // Read through a ref so translated messages never re-run the sync effects.
  const t = useTranslations('sync');
  const tRef = useRef(t);
  tRef.current = t;
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
  const roleRef = useRef(role);
  roleRef.current = role;
  // Set when an admin confirms moving a locked (motor-plan) button; the next
  // save of this board then asks the server to accept that move.
  const motorPlanOverrideRef = useRef(false);
  // A refused save's message stays up until a save succeeds (a later empty
  // queue flush must not hide why the change was not applied).
  const rejectionShownRef = useRef(false);

  useEffect(() => {
    setBoardIdState(loadSelectedBoardId());
  }, []);

  useEffect(() => {
    motorPlanOverrideRef.current = false;
  }, [boardId]);

  const markMotorPlanningOverride = useCallback(() => {
    if (roleRef.current === 'admin') motorPlanOverrideRef.current = true;
  }, []);

  const saveOptions = () => ({
    forceMotorPlanning: motorPlanOverrideRef.current && roleRef.current === 'admin',
  });

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
        setSyncError(tRef.current('refreshedByOtherEditor'));
      }
    } catch {
      setSyncError(tRef.current('versionConflictReload'));
    }
  }, [boardId, client, setBoard]);

  /**
   * A save the server refused for good (422 motor-plan violation, 400, 403 …):
   * drop it from the queue instead of retrying it forever, reload the board
   * the server holds after a motor-plan refusal, and say why.
   */
  const dropRejectedSave = useCallback(
    async (kind: 'motor-plan' | 'rejected', err: unknown): Promise<string> => {
      await clearPendingBoardSave(boardId);
      setPendingSave(false);
      motorPlanOverrideRef.current = false;
      const message =
        kind === 'motor-plan'
          ? tRef.current('motorPlanRejected')
          : tRef.current('saveRejected', { detail: (err as Error).message });
      if (kind === 'motor-plan') {
        try {
          setBoard(await client.getBoard(boardId));
        } catch {
          /* keep the local board; the message still explains the refusal */
        }
      }
      setSyncError(message);
      rejectionShownRef.current = true;
      return message;
    },
    [boardId, client, setBoard],
  );

  const clearConflictNotice = useCallback(() => {
    setConflictRefreshed(false);
  }, []);

  const flushPendingSave = useCallback(async () => {
    if (boardId === DEMO_BOARD_ID) {
      // The demo board is read-only on the server; drop any edit queued for it
      // before that rule existed instead of retrying it forever.
      await clearPendingBoardSave(boardId);
      setPendingSave(false);
      return;
    }
    const pending = await loadPendingBoardSave(boardId);
    if (!pending) {
      setPendingSave(false);
      if (!rejectionShownRef.current) setSyncError(null);
      return;
    }

    try {
      const result = await client.saveBoard(pending, pending.version, saveOptions());
      setBoard(result.board);
      await clearPendingBoardSave(boardId);
      setPendingSave(false);
      setSyncError(null);
      setError(null);
      motorPlanOverrideRef.current = false;
      rejectionShownRef.current = false;
    } catch (err) {
      if (isVersionConflictError(err)) {
        await applyVersionConflict();
        return;
      }
      const kind = classifySaveFailure(err);
      if (kind !== 'retry') {
        await dropRejectedSave(kind, err);
        return;
      }
      setPendingSave(true);
      setSyncError((err as Error).message);
    }
  }, [applyVersionConflict, boardId, client, dropRejectedSave, setBoard]);

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
      setError(cached ? tRef.current('offlineCached') : tRef.current('apiUnreachable'));
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
        setError(cached ? tRef.current('offlineCached') : tRef.current('apiUnreachable'));
        await refreshPendingFlag();
        return;
      }

      disconnect = client.connectBoardSync(
        boardId,
        async (event: SyncEvent) => {
          if (cancelled || event.actorUserId === sessionUserId) return;
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
          // A socket from an earlier client (before the session loaded, or for
          // another board) closes after its replacement opened: ignore it, or
          // the badge would read offline while the current socket is live.
          if (cancelled) return;
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
      const result = await client.saveBoard(boardRef.current, boardRef.current.version, saveOptions());
      setBoard(result.board);
      await clearPendingBoardSave(boardId);
      setPendingSave(false);
      setSyncError(null);
      setConflictRefreshed(false);
      motorPlanOverrideRef.current = false;
      rejectionShownRef.current = false;
      return result;
    } catch (err) {
      if (isVersionConflictError(err)) {
        await applyVersionConflict(true);
        return { conflict: true };
      }
      const kind = classifySaveFailure(err);
      if (kind !== 'retry') {
        throw new Error(await dropRejectedSave(kind, err));
      }
      await queuePendingBoardSave(boardId, boardRef.current);
      setPendingSave(true);
      void registerBackgroundSync();
      throw new Error(tRef.current('saveQueued'));
    }
  }, [applyVersionConflict, boardId, client, dropRejectedSave, setBoard]);

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

  const importGridset = useCallback(
    async (archive: ArrayBuffer) => {
      const result = await client.importGridset(boardId, archive);
      setBoard(result.board);
      setWarnings(result.warnings);
      return result;
    },
    [boardId, client, setBoard],
  );

  const importSnap = useCallback(
    async (archive: ArrayBuffer) => {
      const result = await client.importSnap(boardId, archive);
      setBoard(result.board);
      setWarnings(result.warnings);
      return result;
    },
    [boardId, client, setBoard],
  );

  const importTouchChat = useCallback(
    async (archive: ArrayBuffer) => {
      const result = await client.importTouchChat(boardId, archive);
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
    async (name: string, templateId?: StarterTemplateId, contentLocale?: string) => {
      const id = `board-${Date.now()}`;
      const template: Board = {
        id: createBoardId(id),
        name,
        profileId: createProfileId('default'),
        version: 1,
        updatedAt: new Date().toISOString(),
        grid: { rows: 4, columns: 4, buttons: [] },
      };
      const result = await client.createBoard(template, templateId, contentLocale);
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
    markMotorPlanningOverride,
    importObf,
    exportObf,
    importObz,
    importGridset,
    importSnap,
    importTouchChat,
    exportObz,
    isEditor,
    isAuthenticated: Boolean(accessToken),
    accessToken,
    sessionUserId,
    sessionTeamRole,
  };
}
