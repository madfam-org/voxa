'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardButton, BoardDisplayPreferences, PartOfSpeechTag, StarterTemplateId, TeamRole } from '@voxa/core';
import {
  applyKeyboardActivation,
  DEMO_BOARD_ID,
  formatKeyboardUtterance,
  isKeyboardSpeakButton,
  isLiteracyKeyboardBoard,
} from '@voxa/core';
import { fitzgeraldColor, createButtonAtCell, moveButtonToCell, resizeBoardGrid, type PartOfSpeech } from '@voxa/vocabulary';
import { AacButton, BoardGrid, CVI_THEMES, themeStyles } from '@voxa/ui';
import {
  buttonBorderColor,
  buttonLabel,
  buttonSpeech,
  buttonSymbolUrl,
  downloadTextFile,
  downloadBinaryFile,
  posOptions,
  useObfFileInput,
  useObzFileInput,
  useGridsetFileInput,
  useSnapFileInput,
  useTouchChatFileInput,
} from '@/lib/board-utils';
import { effectiveDisplaySettings } from '@/lib/communicator-settings';
import { useCommunicatorSettings } from '@/hooks/use-communicator-settings';
import { useEyeDwellByButton } from '@/hooks/use-eye-dwell';
import { useGazeBridgeDwell } from '@/hooks/use-gaze-bridge-dwell';
import { usePredictions } from '@/hooks/use-predictions';
import { useSwitchScan } from '@/hooks/use-switch-scan';
import { useSyncedBoard, type BoardSummary } from '@/hooks/use-synced-board';
import {
  editorPinIsConfigured,
  isEditorUnlocked,
  lockEditorSession,
  unlockEditor,
} from '@/lib/editor-pin';
import { logButtonActivation } from '@/lib/log-activation';
import { speakButton, speakText, subscribeSpeechActivity } from '@/lib/play-button-speech';
import { PredictionStrip } from '@/components/prediction-strip';
import { SymbolSearchPanel } from '@/components/symbol-search-panel';
import { SettingsPanel } from '@/components/settings-panel';
import { UsageReportPanel } from '@/components/usage-report-panel';
import { GridSettingsPanel } from '@/components/grid-settings-panel';
import { RecordedMediaPanel } from '@/components/recorded-media-panel';
import { WordFormsPanel } from '@/components/word-forms-panel';
import { BoardAuditPanel } from '@/components/board-audit-panel';
import { SyncStatusBanner } from '@/components/sync-status-banner';
import { DraggableButtonShell, EditorGridCell } from '@/components/editor-grid-cell';

const headerBtn: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  minWidth: 38,
  minHeight: 38,
  cursor: 'pointer',
  fontWeight: 600,
};

const secondaryBtn: React.CSSProperties = {
  ...headerBtn,
  background: '#262626',
  border: '1px solid #404040',
};

export interface BoardScreenProps {
  mode?: 'communicator' | 'remote-editor';
}

export function BoardScreen({ mode = 'communicator' }: BoardScreenProps): React.ReactNode {
  const remoteEditor = mode === 'remote-editor';
  const [role, setRole] = useState<TeamRole>(remoteEditor ? 'editor' : 'communicator');
  const [utterance, setUtterance] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [babbleActive, setBabbleActive] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);
  const [newBoardTemplate, setNewBoardTemplate] = useState<'' | StarterTemplateId>('core-47');
  const pendingTouchRef = useRef<string | null>(null);

  const [recentButtonIds, setRecentButtonIds] = useState<string[]>([]);
  const formTapRef = useRef<{ buttonId: string; at: number; index: number } | null>(null);
  const { settings, setSettings } = useCommunicatorSettings();
  const {
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
    retryPendingSave,
    saveBoard,
    importObf,
    exportObf,
    importObz,
    importGridset,
    importSnap,
    importTouchChat,
    exportObz,
    isEditor,
    isAuthenticated,
    accessToken,
    sessionUserId,
    sessionTeamRole,
  } = useSyncedBoard(role);

  const trustedEditorSession =
    isAuthenticated && (sessionTeamRole === 'editor' || sessionTeamRole === 'admin');

  const displaySettings = effectiveDisplaySettings(settings, board.display);

  useEffect(() => subscribeSpeechActivity(setSpeechActive), []);

  useEffect(() => {
    if (!remoteEditor || !isAuthenticated) return;
    setRole(sessionTeamRole === 'admin' ? 'admin' : sessionTeamRole === 'editor' ? 'editor' : 'communicator');
  }, [remoteEditor, isAuthenticated, sessionTeamRole]);

  useEffect(() => {
    setBabbleActive(false);
  }, [boardId]);

  const sorted = [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );

  const visibleButtons = sorted.filter(
    (btn) => isEditor || !btn.hidden || (!isEditor && babbleActive),
  );

  const literacyMode = isLiteracyKeyboardBoard(board);
  const literacyDisplay = literacyMode
    ? { hideSymbols: true, hideLabels: displaySettings.hideLabels }
    : displaySettings;

  const { textPredictions, symbolPredictions } = usePredictions(board, utterance, recentButtonIds);

  const resolveActivationSpeech = useCallback((btn: BoardButton): string => {
    if (btn.kind !== 'analytic' || !btn.speechForms?.length) {
      return buttonSpeech(btn);
    }

    const forms = btn.speechForms;
    let index = forms.findIndex((form) => form.id === btn.activeSpeechFormId);
    if (index < 0) index = 0;

    const now = Date.now();
    const last = formTapRef.current;
    if (last?.buttonId === (btn.id as string) && now - last.at < 900) {
      index = (last.index + 1) % forms.length;
    }

    formTapRef.current = { buttonId: btn.id as string, at: now, index };
    return buttonSpeech(btn, index);
  }, []);

  const activate = useCallback(
    (btn: BoardButton) => {
      if (isEditor && editingId) return;

      if (btn.navigateToBoardId) {
        setBoardId(btn.navigateToBoardId as string);
        return;
      }

      if (literacyMode && btn.kind === 'analytic' && btn.keyboardRole) {
        if (isKeyboardSpeakButton(btn)) {
          const text = formatKeyboardUtterance(utterance);
          if (text && !settings.whisperMode) speakText(text);
          return;
        }
        const result = applyKeyboardActivation(utterance, btn);
        setUtterance(result.utterance);
        return;
      }

      const text = resolveActivationSpeech(btn);
      setUtterance((prev) => [...prev, text]);
      setRecentButtonIds((prev) => [...prev, btn.id as string].slice(-8));
      void logButtonActivation(accessToken, {
        boardId,
        buttonId: btn.id as string,
        speechText: text,
      });
      if (!settings.whisperMode) {
        void speakButton(btn, { accessToken, speechText: text });
      }
    },
    [
      accessToken,
      boardId,
      isEditor,
      editingId,
      literacyMode,
      utterance,
      resolveActivationSpeech,
      setBoardId,
      settings.whisperMode,
    ],
  );

  const applyPrediction = useCallback(
    (text: string) => {
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean) : [];
      setUtterance(words);
      if (!settings.whisperMode) speakText(text);
    },
    [settings.whisperMode],
  );

  const switchScanEnabled = settings.accessMode === 'switch' && !isEditor;
  const eyeDwellEnabled = settings.accessMode === 'eye-tracking' && !isEditor;
  const scanPaused = settings.pauseScanWhileSpeaking && speechActive;

  const { isHighlighted, isGroupHighlighted, liveRef } = useSwitchScan({
    enabled: switchScanEnabled,
    paused: scanPaused,
    rows: board.grid.rows,
    columns: board.grid.columns,
    buttons: visibleButtons,
    intervalMs: settings.switchIntervalMs,
    order: settings.switchOrder,
    groupStrategy: settings.switchGroupStrategy,
    auditoryHighlight: settings.auditoryScanHighlight,
    auditoryVoice: settings.auditoryScanVoice,
    onSelect: activate,
    getLabel: buttonLabel,
  });

  const { onEnter, onLeave, dwellProgressFor: pointerDwellProgress } = useEyeDwellByButton(
    eyeDwellEnabled && settings.gazeSource === 'pointer',
    settings.eyeDwellMs,
    (buttonId) => {
      const btn = visibleButtons.find((b) => (b.id as string) === buttonId);
      if (btn) activate(btn);
    },
  );

  const { dwellProgressFor: bridgeDwellProgress } = useGazeBridgeDwell({
    enabled: eyeDwellEnabled && settings.gazeSource === 'tobii-bridge',
    dwellMs: settings.eyeDwellMs,
    onActivate: (buttonId) => {
      const btn = visibleButtons.find((b) => (b.id as string) === buttonId);
      if (btn) activate(btn);
    },
  });

  const dwellProgressFor =
    settings.gazeSource === 'tobii-bridge' ? bridgeDwellProgress : pointerDwellProgress;

  const speakAll = useCallback(() => {
    const text = literacyMode ? formatKeyboardUtterance(utterance) : utterance.join(' ');
    if (!text) return;
    speakText(text);
  }, [literacyMode, utterance]);

  const handleImport = useCallback(
    async (raw: string) => {
      setBusy(true);
      try {
        await importObf(raw);
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [importObf],
  );

  const handleImportObz = useCallback(
    async (archive: ArrayBuffer) => {
      setBusy(true);
      try {
        await importObz(archive);
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [importObz],
  );

  const handleImportGridset = useCallback(
    async (archive: ArrayBuffer) => {
      setBusy(true);
      try {
        await importGridset(archive);
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [importGridset],
  );

  const handleImportSnap = useCallback(
    async (archive: ArrayBuffer) => {
      setBusy(true);
      try {
        await importSnap(archive);
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [importSnap],
  );

  const handleImportTouchChat = useCallback(
    async (archive: ArrayBuffer) => {
      setBusy(true);
      try {
        await importTouchChat(archive);
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [importTouchChat],
  );

  const { open: openObfImport, input: obfInput } = useObfFileInput(handleImport);
  const { open: openObzImport, input: obzInput } = useObzFileInput(handleImportObz);
  const { open: openGridsetImport, input: gridsetInput } = useGridsetFileInput(handleImportGridset);
  const { open: openSnapImport, input: snapInput } = useSnapFileInput(handleImportSnap);
  const { open: openTouchChatImport, input: touchChatInput } = useTouchChatFileInput(handleImportTouchChat);

  const handleExportObz = useCallback(async () => {
    setBusy(true);
    try {
      const archive = await exportObz();
      downloadBinaryFile(`${board.id as string}.obz`, archive, 'application/zip');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [exportObz, board.id]);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const json = await exportObf();
      downloadTextFile(`${board.id as string}.obf`, json);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [exportObf, board.id]);

  const handleCreateBoard = useCallback(async () => {
    const name = window.prompt('Board name', 'My board');
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await createBoard(name.trim(), newBoardTemplate || undefined);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [createBoard, newBoardTemplate]);

  const handleRenameBoard = useCallback(async () => {
    const name = window.prompt('Board name', board.name);
    if (!name?.trim() || name.trim() === board.name) return;
    setBusy(true);
    try {
      await renameBoard(name.trim());
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [board.name, renameBoard]);

  const handleDuplicateBoard = useCallback(async () => {
    setBusy(true);
    try {
      await duplicateBoard();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [duplicateBoard]);

  const handleDeleteBoard = useCallback(async () => {
    if (boardId === DEMO_BOARD_ID) {
      alert('The demo board cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete board "${board.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteBoard();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [board.name, boardId, deleteBoard]);

  const handleApplyGrid = useCallback(
    (rows: number, columns: number) => {
      try {
        const result = resizeBoardGrid(board.grid.buttons, rows, columns);
        setBoard({
          ...board,
          grid: {
            rows: result.rows,
            columns: result.columns,
            buttons: result.buttons,
          },
        });
        if (result.warnings.length > 0) {
          window.alert(result.warnings.join('\n'));
        }
        setGridOpen(false);
      } catch (err) {
        alert((err as Error).message);
      }
    },
    [board, setBoard],
  );

  const handleRoleChange = useCallback(
    (nextRole: TeamRole) => {
      if (nextRole === 'communicator') {
        lockEditorSession();
        setRole('communicator');
        setEditingId(null);
        return;
      }
      setBabbleActive(false);

      const skipPin = remoteEditor || trustedEditorSession;
      if (skipPin || !editorPinIsConfigured() || isEditorUnlocked()) {
        setRole(nextRole);
        return;
      }

      const pin = window.prompt('Enter editor PIN to unlock vocabulary editing');
      if (pin && unlockEditor(pin)) {
        setRole(nextRole);
        return;
      }

      if (pin) {
        window.alert('Incorrect PIN. Editor mode stays locked.');
      }
    },
    [remoteEditor, trustedEditorSession],
  );

  const handleSave = useCallback(async () => {
    setBusy(true);
    try {
      const result = await saveBoard();
      if (result && 'conflict' in result) return;
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [saveBoard]);

  const updateButton = (buttonId: string, patch: Partial<BoardButton>) => {
    setBoard({
      ...board,
      grid: {
        ...board.grid,
        buttons: board.grid.buttons.map((b) =>
          (b.id as string) === buttonId ? ({ ...b, ...patch } as BoardButton) : b,
        ),
      },
    });
  };

  const handleBoardDisplayChange = useCallback(
    (patch: Partial<BoardDisplayPreferences>) => {
      const next: BoardDisplayPreferences = { ...board.display };
      for (const [key, value] of Object.entries(patch) as Array<
        [keyof BoardDisplayPreferences, boolean | undefined]
      >) {
        if (value === undefined) delete next[key];
        else next[key] = value;
      }
      setBoard({
        ...board,
        display: Object.keys(next).length > 0 ? next : undefined,
      });
    },
    [board, setBoard],
  );

  const handleGridDrop = useCallback(
    (buttonId: string, row: number, column: number) => {
      try {
        const moving = board.grid.buttons.find((b) => (b.id as string) === buttonId);
        const target = board.grid.buttons.find(
          (b) => b.position.row === row && b.position.column === column,
        );
        const needsOverride = Boolean(
          moving?.locked || (target && target.locked && (target.id as string) !== buttonId),
        );
        const forceLocked =
          needsOverride &&
          role === 'admin' &&
          window.confirm('Override motor-plan lock and move this slot?');
        if (needsOverride && !forceLocked) {
          window.alert('That slot is locked. Unlock it in the button editor or use Admin override.');
          return;
        }
        const result = moveButtonToCell(board.grid.buttons, buttonId, row, column, {
          forceLocked: forceLocked || undefined,
        });
        setBoard({ ...board, grid: { ...board.grid, buttons: result.buttons } });
      } catch (err) {
        window.alert((err as Error).message);
      }
    },
    [board, role, setBoard],
  );

  const handleAddButtonAt = useCallback(
    (row: number, column: number) => {
      const label = window.prompt('Button label');
      if (!label?.trim()) return;
      try {
        const buttons = createButtonAtCell(board.grid.buttons, row, column, label.trim());
        setBoard({ ...board, grid: { ...board.grid, buttons } });
      } catch (err) {
        window.alert((err as Error).message);
      }
    },
    [board, setBoard],
  );

  const theme = settings.cviTheme;
  const shellStyle = themeStyles(theme);
  const syncLabel =
    syncStatus === 'live'
      ? pendingSave
        ? '● Live (save queued)'
        : '● Live'
      : syncStatus === 'connecting'
        ? '… Connecting'
        : '○ Offline';

  const handleButtonPress = (btn: BoardButton) => {
    if (isEditor) {
      setEditingId(btn.id as string);
      return;
    }
    if (settings.accessMode === 'touch' && settings.touchActivation === 'press') {
      activate(btn);
    }
  };

  const touchReleaseHandlers = (btn: BoardButton) => {
    if (isEditor || settings.accessMode !== 'touch' || settings.touchActivation !== 'release') {
      return {};
    }
    const id = btn.id as string;
    return {
      onPointerDown: () => {
        pendingTouchRef.current = id;
      },
      onPointerUp: () => {
        if (pendingTouchRef.current === id) activate(btn);
        pendingTouchRef.current = null;
      },
      onPointerLeave: () => {
        if (pendingTouchRef.current === id) pendingTouchRef.current = null;
      },
    };
  };

  const buttonAt = (row: number, column: number): BoardButton | undefined =>
    sorted.find((b) => b.position.row === row && b.position.column === column);

  const isButtonVisible = (btn: BoardButton): boolean =>
    isEditor || !btn.hidden || babbleActive;

  const renderGridButton = (btn: BoardButton): React.ReactNode => {
    const revealedHidden = babbleActive && !isEditor && btn.hidden;
    return (
      <AacButton
        label={buttonLabel(btn)}
        data-voxa-button-id={btn.id as string}
        symbolUrl={buttonSymbolUrl(btn)}
        borderColor={buttonBorderColor(btn)}
        targetScale={settings.targetScale}
        hideSymbol={literacyDisplay.hideSymbols}
        hideLabel={literacyDisplay.hideLabels}
        scanHighlighted={isHighlighted(btn)}
        scanGroupHighlighted={isGroupHighlighted(btn)}
        dwellProgress={dwellProgressFor(btn.id as string)}
        onClick={() => handleButtonPress(btn)}
        {...touchReleaseHandlers(btn)}
        onPointerEnter={() => onEnter(btn.id as string)}
        onPointerLeave={onLeave}
        style={revealedHidden ? { opacity: 0.72, outline: '2px dashed #f59e0b' } : undefined}
        aria-label={
          isEditor && btn.locked
            ? `${buttonLabel(btn)} (locked motor-plan slot)`
            : revealedHidden
              ? `${buttonLabel(btn)} (hidden, babble mode)`
              : buttonLabel(btn)
        }
      >
        {isEditor && btn.locked ? (
          <span aria-hidden style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.75rem', lineHeight: 1 }}>
            🔒
          </span>
        ) : null}
        {!isEditor && btn.kind === 'analytic' && (btn.speechForms?.length ?? 0) > 1 ? (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              fontSize: '0.625rem',
              color: '#93c5fd',
              fontWeight: 700,
            }}
          >
            ↻
          </span>
        ) : null}
      </AacButton>
    );
  };

  const gridCells: React.ReactNode[] = [];
  for (let row = 0; row < board.grid.rows; row += 1) {
    for (let col = 0; col < board.grid.columns; col += 1) {
      const btn = buttonAt(row, col);
      const key = `cell-${row}-${col}`;
      if (btn && isButtonVisible(btn)) {
        const content = renderGridButton(btn);
        gridCells.push(
          isEditor ? (
            <EditorGridCell key={key} row={row} column={col} occupied onDropButton={handleGridDrop}>
              <DraggableButtonShell
                buttonId={btn.id as string}
                draggable={!btn.locked || role === 'admin'}
              >
                {content}
              </DraggableButtonShell>
            </EditorGridCell>
          ) : (
            <div key={key} style={{ width: '100%', height: '100%' }}>
              {content}
            </div>
          ),
        );
      } else if (isEditor) {
        gridCells.push(
          <EditorGridCell
            key={key}
            row={row}
            column={col}
            onDropButton={handleGridDrop}
            onAddButton={handleAddButtonAt}
          />,
        );
      } else {
        gridCells.push(<div key={key} aria-hidden style={{ width: '100%', height: '100%' }} />);
      }
    }
  }

  return (
    <div style={{ ...shellStyle, display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {obfInput}
      {obzInput}
      {gridsetInput}
      {snapInput}
      {touchChatInput}
      <div ref={liveRef} aria-live="polite" aria-atomic="true" style={visuallyHidden} />

      {remoteEditor ? (
        <div
          style={{
            padding: '10px 16px',
            background: '#172554',
            color: '#dbeafe',
            borderBottom: '1px solid #1d4ed8',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          {trustedEditorSession ? (
            <>
              <strong>Remote SLP editor</strong> — edit vocabulary without the communicator device. Changes
              sync to the cloud; the communicator app picks them up automatically.
            </>
          ) : isAuthenticated ? (
            <>Your signed-in account does not have SLP editor permissions. Contact your organization admin.</>
          ) : (
            <>
              Sign in with your clinician account to edit boards remotely.{' '}
              <a href="/auth/signin?redirect_to=%2Fapp%2Fedit" style={{ color: '#93c5fd' }}>
                Sign in
              </a>
            </>
          )}
        </div>
      ) : null}

      <header
        style={{
          padding: '12px 16px',
          background: CVI_THEMES[theme].background,
          color: CVI_THEMES[theme].foreground,
          borderBottom: `1px solid ${CVI_THEMES[theme].buttonBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ fontSize: '1.125rem' }}>
          <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            Voxa
          </a>
        </strong>

        {isAuthenticated && boardCatalog.length > 0 ? (
          <select
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            style={selectStyle}
            aria-label="Board"
          >
            {boardCatalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ opacity: 0.7, fontSize: '0.875rem' }}>{board.name}</span>
        )}

        {isEditor && isAuthenticated && (
          <>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
              Template
              <select
                value={newBoardTemplate}
                onChange={(e) => setNewBoardTemplate(e.target.value as '' | StarterTemplateId)}
                style={{ background: '#262626', color: '#f5f5f5', border: '1px solid #404040', borderRadius: 6 }}
              >
                <option value="">Blank 4×4</option>
                <option value="core-47">Core 47</option>
                <option value="core-100">Core 100</option>
                <option value="literacy-keyboard">Literacy Keyboard</option>
              </select>
            </label>
            <button type="button" onClick={handleCreateBoard} disabled={busy} style={secondaryBtn}>
              New board
            </button>
            <button type="button" onClick={() => void handleRenameBoard()} disabled={busy} style={secondaryBtn}>
              Rename
            </button>
            <button type="button" onClick={() => void handleDuplicateBoard()} disabled={busy} style={secondaryBtn}>
              Duplicate
            </button>
            {boardId !== DEMO_BOARD_ID ? (
              <button type="button" onClick={() => void handleDeleteBoard()} disabled={busy} style={secondaryBtn}>
                Delete
              </button>
            ) : null}
          </>
        )}

        <span
          style={{
            fontSize: '0.75rem',
            color: syncStatus === 'live' ? '#4ade80' : CVI_THEMES[theme].foreground,
          }}
        >
          {syncLabel} v{board.version}
        </span>

        <select
          value={role}
          onChange={(e) => handleRoleChange(e.target.value as TeamRole)}
          style={selectStyle}
          aria-label="Team role"
          disabled={remoteEditor}
        >
          <option value="communicator">Communicator</option>
          <option value="editor">Editor (SLP)</option>
          <option value="admin">Admin</option>
        </select>

        {remoteEditor ? (
          <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>Role from your account</span>
        ) : null}

        {!isEditor ? (
          <button
            type="button"
            onClick={() => setBabbleActive((active) => !active)}
            style={{
              ...secondaryBtn,
              background: babbleActive ? '#422006' : secondaryBtn.background,
              borderColor: babbleActive ? '#f59e0b' : '#404040',
            }}
            aria-pressed={babbleActive}
          >
            Babble
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setUsageOpen(false);
            setSettingsOpen((v) => !v);
          }}
          style={secondaryBtn}
        >
          Settings
        </button>

        {isEditor && isAuthenticated ? (
          <>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setAuditOpen((v) => !v);
                setUsageOpen(false);
              }}
              style={secondaryBtn}
            >
              Audit
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setUsageOpen((v) => !v);
                setAuditOpen(false);
              }}
              style={secondaryBtn}
            >
              Usage
            </button>
          </>
        ) : null}

        {!isAuthenticated ? (
          <a
            href={remoteEditor ? '/auth/signin?redirect_to=%2Fapp%2Fedit' : '/auth/signin?redirect_to=%2Fapp'}
            style={{ ...secondaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Sign in
          </a>
        ) : null}

        {isAuthenticated && (
          <a href="/auth/signout" style={{ ...secondaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Sign out
          </a>
        )}

        <div style={utteranceBarStyle}>
          {literacyMode
            ? formatKeyboardUtterance(utterance) || 'Type on the keyboard…'
            : utterance.length
              ? utterance.join(' ')
              : 'Tap buttons to build a message…'}
        </div>

        <button type="button" onClick={speakAll} style={headerBtn}>
          Speak
        </button>
        <button type="button" onClick={() => setUtterance([])} style={headerBtn}>
          Clear
        </button>

        {isEditor && (
          <>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setUsageOpen(false);
                setGridOpen((v) => !v);
              }}
              style={secondaryBtn}
            >
              Grid
            </button>
            <button type="button" onClick={openObfImport} disabled={busy} style={secondaryBtn}>
              Import OBF
            </button>
            <button type="button" onClick={openObzImport} disabled={busy} style={secondaryBtn}>
              Import OBZ
            </button>
            <button type="button" onClick={openGridsetImport} disabled={busy} style={secondaryBtn}>
              Import Grid
            </button>
            <button type="button" onClick={openSnapImport} disabled={busy} style={secondaryBtn}>
              Import Snap
            </button>
            <button type="button" onClick={openTouchChatImport} disabled={busy} style={secondaryBtn}>
              Import TouchChat
            </button>
            <button type="button" onClick={handleExport} disabled={busy} style={secondaryBtn}>
              Export OBF
            </button>
            <button type="button" onClick={() => void handleExportObz()} disabled={busy} style={secondaryBtn}>
              Export OBZ
            </button>
            <button type="button" onClick={handleSave} disabled={busy} style={secondaryBtn}>
              Save
            </button>
          </>
        )}
      </header>

      {babbleActive && !isEditor ? (
        <div
          style={{
            background: '#422006',
            color: '#fcd34d',
            padding: '6px 16px',
            fontSize: '0.8125rem',
          }}
        >
          Babble mode — hidden vocabulary is visible for this session. Turn off Babble to restore the
          motor plan.
        </div>
      ) : null}

      <SyncStatusBanner
        syncStatus={syncStatus}
        pendingSave={pendingSave}
        syncError={syncError}
        error={error}
        conflictRefreshed={conflictRefreshed}
        warnings={warnings}
        isEditor={isEditor}
        onRetry={retryPendingSave}
        onDismissConflict={clearConflictNotice}
      />

      {isEditor ? (
        <div
          style={{
            background: '#171717',
            color: '#a3a3a3',
            padding: '6px 16px',
            fontSize: '0.8125rem',
          }}
        >
          Drag unlocked buttons to move or swap. Drop on + cells to add vocabulary. Locked slots show 🔒.
        </div>
      ) : null}

      {!isEditor && (
        <PredictionStrip
          textPredictions={textPredictions}
          symbolPredictions={symbolPredictions}
          buttons={sorted}
          onApplyText={applyPrediction}
          onSelectSymbol={activate}
        />
      )}

      <main style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <BoardGrid
          rows={board.grid.rows}
          columns={board.grid.columns}
          theme={theme}
          targetScale={settings.targetScale}
        >
          {gridCells}
        </BoardGrid>

        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            onClose={() => setSettingsOpen(false)}
            showEditorPinSettings={role === 'admin'}
            boardDisplay={board.display}
            onBoardDisplayChange={isEditor ? handleBoardDisplayChange : undefined}
          />
        )}

        {usageOpen && isEditor && isAuthenticated ? (
          <UsageReportPanel
            boardId={boardId}
            accessToken={accessToken}
            buttons={sorted}
            onClose={() => setUsageOpen(false)}
          />
        ) : null}

        {auditOpen && isEditor && isAuthenticated ? (
          <BoardAuditPanel
            boardId={boardId}
            accessToken={accessToken}
            onClose={() => setAuditOpen(false)}
          />
        ) : null}

        {gridOpen && isEditor ? (
          <GridSettingsPanel
            rows={board.grid.rows}
            columns={board.grid.columns}
            buttonCount={board.grid.buttons.length}
            onApply={handleApplyGrid}
            onClose={() => setGridOpen(false)}
          />
        ) : null}

        {isEditor && editingId && (
          <EditorPanel
            button={sorted.find((b) => (b.id as string) === editingId)!}
            boardId={boardId}
            boardCatalog={boardCatalog}
            accessToken={accessToken}
            recordedBy={sessionUserId}
            onClose={() => setEditingId(null)}
            onChange={(patch) => updateButton(editingId, patch)}
          />
        )}
      </main>

      <footer
        style={{
          padding: '10px 16px',
          fontSize: '0.75rem',
          color: '#a3a3a3',
          borderTop: '1px solid #262626',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <a href="/legal/privacy" style={{ color: '#93c5fd' }}>
          Privacy
        </a>
        <a href="/legal/terms" style={{ color: '#93c5fd' }}>
          Terms
        </a>
        <a href="/legal/accessibility" style={{ color: '#93c5fd' }}>
          Accessibility
        </a>
      </footer>
    </div>
  );
}

function EditorPanel({
  button,
  boardId,
  boardCatalog,
  accessToken,
  recordedBy,
  onClose,
  onChange,
}: {
  button: BoardButton;
  boardId: string;
  boardCatalog: BoardSummary[];
  accessToken?: string;
  recordedBy: string;
  onClose: () => void;
  onChange: (patch: Partial<BoardButton>) => void;
}) {
  const label = button.kind === 'analytic' ? button.label : button.phrase;
  const speech = button.kind === 'analytic' ? button.speechText : button.phrase;
  const fieldsLocked = button.locked;

  return (
    <aside
      style={{
        width: 280,
        background: '#111',
        color: '#f5f5f5',
        borderLeft: '1px solid #333',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <h2 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Edit button</h2>

      <SymbolSearchPanel
        boardId={boardId}
        accessToken={accessToken}
        currentUrl={button.symbolUrl}
        disabled={fieldsLocked}
        onSelect={(imageUrl) => onChange({ symbolUrl: imageUrl })}
        onClear={() => onChange({ symbolUrl: undefined })}
      />

      <RecordedMediaPanel
        boardId={boardId}
        accessToken={accessToken}
        recordedBy={recordedBy}
        button={button}
        disabled={fieldsLocked}
        onAudioChange={(audio) => onChange({ audio })}
        onVideoChange={(video) => {
          if (button.kind === 'glp') onChange({ video });
        }}
      />

      <label style={labelStyle}>
        Link to board (OBF navigation)
        <select
          style={fieldStyle}
          value={(button.navigateToBoardId as string | undefined) ?? ''}
          disabled={fieldsLocked}
          onChange={(e) =>
            onChange({
              navigateToBoardId: e.target.value
                ? (e.target.value as BoardButton['navigateToBoardId'])
                : undefined,
            })
          }
        >
          <option value="">None — speak only</option>
          {boardCatalog
            .filter((item) => item.id !== boardId)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>

      {fieldsLocked ? (
        <p style={{ fontSize: '0.8125rem', color: '#fcd34d', margin: '0 0 12px' }}>
          Motor-plan slot locked — unlock below to change label, speech, or visibility.
        </p>
      ) : null}

      <label style={labelStyle}>
        Label
        <input
          style={fieldStyle}
          value={label}
          disabled={fieldsLocked}
          onChange={(e) =>
            button.kind === 'analytic'
              ? onChange({ label: e.target.value, speechText: e.target.value })
              : onChange({ phrase: e.target.value })
          }
        />
      </label>

      {button.kind === 'analytic' && (
        <label style={labelStyle}>
          Speech
          <input
            style={fieldStyle}
            value={speech}
            disabled={fieldsLocked}
            onChange={(e) => onChange({ speechText: e.target.value })}
          />
        </label>
      )}

      {button.kind === 'analytic' && (
        <WordFormsPanel button={button} disabled={fieldsLocked} onChange={onChange} />
      )}

      <label style={labelStyle}>
        Part of speech
        <select
          style={fieldStyle}
          value={button.partOfSpeech ?? 'noun'}
          disabled={fieldsLocked}
          onChange={(e) => onChange({ partOfSpeech: e.target.value as PartOfSpeechTag })}
        >
          {posOptions().map((pos) => (
            <option key={pos} value={pos}>
              {pos} ({fitzgeraldColor(pos as PartOfSpeech)})
            </option>
          ))}
        </select>
      </label>

      <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={button.locked}
          onChange={(e) => onChange({ locked: e.target.checked })}
        />
        Lock position (motor planning)
      </label>

      <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={button.hidden ?? false}
          disabled={fieldsLocked}
          onChange={(e) => onChange({ hidden: e.target.checked })}
        />
        Hide from communicator view
      </label>

      <button type="button" onClick={onClose} style={{ ...headerBtn, marginTop: 16, width: '100%' }}>
        Done
      </button>
    </aside>
  );
}

const selectStyle: React.CSSProperties = {
  background: '#171717',
  color: '#f5f5f5',
  border: '1px solid #404040',
  borderRadius: 6,
  padding: '6px 8px',
  minHeight: 38,
};

const utteranceBarStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 200,
  minHeight: 40,
  background: '#171717',
  borderRadius: 8,
  padding: '8px 12px',
};

const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: '0.875rem',
  marginBottom: 12,
};

const fieldStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #404040',
  borderRadius: 6,
  color: '#f5f5f5',
  padding: '8px 10px',
};
