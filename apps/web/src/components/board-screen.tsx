'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { BoardButton, BoardDisplayPreferences, PartOfSpeechTag, StarterTemplateId, TeamRole } from '@voxa/core';
import {
  applyKeyboardActivation,
  DEMO_BOARD_ID,
  formatKeyboardUtterance,
  isKeyboardSpeakButton,
  isLiteracyKeyboardBoard,
  isVisualScheduleBoard,
  listScheduleSteps,
  scheduleProgress,
} from '@voxa/core';
import { touchGuardActive, activatesOnPress, activatesOnRelease } from '@voxa/access';
import { fitzgeraldColor, createButtonAtCell, moveButtonToCell, resizeBoardGrid, type PartOfSpeech } from '@voxa/vocabulary';
import { AacButton, BoardGrid, CVI_THEMES, themeStyles } from '@voxa/ui';
import {
  buttonBorderColor,
  buttonLabel,
  buttonSpeech,
  buttonSymbolUnavailable,
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
import type { CommunicatorSettings } from '@/lib/communicator-settings';
import { useCommunicatorSettings } from '@/hooks/use-communicator-settings';
import { useSpeechSettings } from '@/hooks/use-device-voices';
import { VoiceMissingNotice } from '@/components/voice-missing-notice';
import { useEyeDwellByButton } from '@/hooks/use-eye-dwell';
import { useGazeBridgeDwell } from '@/hooks/use-gaze-bridge-dwell';
import { usePredictions } from '@/hooks/use-predictions';
import { useSwitchScan } from '@/hooks/use-switch-scan';
import { ScanBackTarget } from '@/components/scan-back-target';
import { ButtonMoveControls, MoveModeBanner } from '@/components/editor-move-controls';
import { useSyncedBoard, type BoardSummary } from '@/hooks/use-synced-board';
import { BETA_IMPORT_FORMATS, classifyImportFailure, contentLocaleForUi, type BoardImportFormat } from '@/lib/board-import';
import { ImportLimitNotice } from '@/components/import-limit-notice';
import { FirstRunSetup, type FirstRunCreateResult } from '@/components/first-run-setup';
import { existingBoardFor, isFirstRunDone, markFirstRunDone, shouldOfferFirstRun } from '@/lib/first-run';
import { VoxaSyncError } from '@voxa/sync';
import {
  editorPinIsConfigured,
  isEditorUnlocked,
  lockEditorSession,
  unlockEditor,
} from '@/lib/editor-pin';
import {
  accountMayEditBoard,
  editorModeAllowed,
  isTrustedEditorSession,
  ownsBoard,
  remoteEditorRole,
} from '@/lib/editor-access';
import { logButtonActivation } from '@/lib/log-activation';
import { speakButton, speakText, subscribeSpeechActivity } from '@/lib/play-button-speech';
import { presentBoardForDisplay } from '@/lib/board-presentation';
import { composeMessage, speakWholeMessage, speechLocaleForBoard } from '@/lib/utterance-speech';
import { useAppDialog } from '@/components/app-dialog';
import { SymbolCredit } from '@/components/symbol-credit';
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
import { VisualScheduleView } from '@/components/visual-schedule-view';
import { TouchGuardListOverlay, TouchGuardOverlay } from '@/components/touch-guard-overlay';
import { brand, neutral, status, surface } from '@/lib/tokens';

const headerBtn: React.CSSProperties = {
  background: brand.primary,
  color: surface.white,
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
  background: surface.overlay,
  border: `1px solid ${neutral.border}`,
};

export interface BoardScreenProps {
  mode?: 'communicator' | 'remote-editor';
}

export function BoardScreen({ mode = 'communicator' }: BoardScreenProps): React.ReactNode {
  const tc = useTranslations('common');
  const tcx = useTranslations('communicator');
  const tn = useTranslations('nav');
  const tb = useTranslations('board');
  const dialogs = useAppDialog();
  const uiLocale = useLocale();
  const remoteEditor = mode === 'remote-editor';
  const [role, setRole] = useState<TeamRole>(remoteEditor ? 'editor' : 'communicator');
  const [utterance, setUtterance] = useState<string[]>([]);
  // Per-message choice to say the words exactly as tapped (no Spanish agreement).
  const [keepBaseForm, setKeepBaseForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Single-pointer move: the button selected with "Move", waiting for a destination cell.
  const [movingId, setMovingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [babbleActive, setBabbleActive] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);
  const [newBoardTemplate, setNewBoardTemplate] = useState<'' | StarterTemplateId>('core-47');
  const [firstRunOpen, setFirstRunOpen] = useState(false);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(() => new Set());
  const pendingTouchRef = useRef<string | null>(null);

  const [recentButtonIds, setRecentButtonIds] = useState<string[]>([]);
  const formTapRef = useRef<{ buttonId: string; at: number; index: number } | null>(null);
  const { settings, setSettings } = useCommunicatorSettings();
  const {
    board,
    boardId,
    boardCatalog,
    catalogStatus,
    reloadCatalog,
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
    markMotorPlanningOverride,
    importBoards,
    exportObf,
    exportObz,
    isEditor,
    isAuthenticated,
    accessToken,
    sessionUserId,
    sessionTeamRole,
  } = useSyncedBoard(role);

  const editorAccess = {
    boardId,
    boardOwnerUserId: board.ownerUserId,
    isAuthenticated,
    sessionUserId,
    sessionTeamRole,
  };
  const trustedEditorSession = isTrustedEditorSession(editorAccess);
  const ownBoard = ownsBoard(editorAccess);
  const canEnterEditor = editorModeAllowed(editorAccess);
  const accountCanEdit = accountMayEditBoard(editorAccess);

  const displaySettings = effectiveDisplaySettings(settings, board.display);

  useEffect(() => subscribeSpeechActivity(setSpeechActive), []);

  useEffect(() => {
    if (!remoteEditor || !isAuthenticated) return;
    setRole(
      remoteEditorRole(
        { boardId, boardOwnerUserId: board.ownerUserId, isAuthenticated, sessionUserId, sessionTeamRole },
        !editorPinIsConfigured() || isEditorUnlocked(),
      ),
    );
  }, [remoteEditor, isAuthenticated, sessionTeamRole, sessionUserId, boardId, board.ownerUserId]);

  // The demo board is read-only: leave editor mode whenever it is shown.
  useEffect(() => {
    if (canEnterEditor) return;
    setRole('communicator');
    setEditingId(null);
  }, [canEnterEditor]);

  useEffect(() => {
    setBabbleActive(false);
    setCompletedStepIds(new Set());
  }, [boardId]);

  const viewBoard = useMemo(
    () => presentBoardForDisplay(board, { boardId, isEditor, uiLocale }),
    [board, boardId, isEditor, uiLocale],
  );
  const speechLocale = speechLocaleForBoard(viewBoard, uiLocale);
  const { deviceVoices, missingVoiceNotice, dismissMissingVoiceNotice } = useSpeechSettings(
    settings,
    setSettings,
    speechLocale,
  );

  const sorted = [...viewBoard.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );

  const visibleButtons = sorted.filter(
    (btn) => isEditor || !btn.hidden || (!isEditor && babbleActive),
  );

  const literacyMode = isLiteracyKeyboardBoard(board);
  const scheduleMode = isVisualScheduleBoard(board);
  const scheduleSteps = scheduleMode ? listScheduleSteps(board) : [];
  const scheduleState = scheduleMode
    ? scheduleProgress(completedStepIds, scheduleSteps)
    : { completed: 0, total: 0, currentStepId: null };
  const touchGuardOn =
    !isEditor &&
    settings.accessMode === 'touch' &&
    touchGuardActive({ enabled: settings.touchGuardEnabled, mask: settings.touchGuardMask });
  const symbolDefaults = { skinTone: settings.defaultSymbolSkinTone };
  const literacyDisplay = literacyMode
    ? { hideSymbols: true, hideLabels: displaySettings.hideLabels }
    : displaySettings;

  const { textPredictions, symbolPredictions } = usePredictions(
    board,
    utterance,
    recentButtonIds,
    settings.contentLocale,
  );

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
          if (text && !settings.whisperMode) speakText(text, speechLocale);
          return;
        }
        const result = applyKeyboardActivation(utterance, btn);
        setUtterance(result.utterance);
        return;
      }

      if (scheduleMode && !isEditor) {
        const text = resolveActivationSpeech(btn);
        setCompletedStepIds((prev) => new Set(prev).add(btn.id as string));
        void logButtonActivation(accessToken, {
          boardId,
          buttonId: btn.id as string,
          speechText: text,
        });
        if (!settings.whisperMode) {
          void speakButton(btn, { speechText: text, closeLabel: tc('close') });
        }
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
        void speakButton(btn, { speechText: text, closeLabel: tc('close') });
      }
    },
    [
      accessToken,
      boardId,
      isEditor,
      editingId,
      literacyMode,
      scheduleMode,
      utterance,
      resolveActivationSpeech,
      setBoardId,
      settings.whisperMode,
      speechLocale,
      tc,
    ],
  );

  // A tapped suggestion becomes the message's words (base forms), so it gets the
  // same Spanish agreement as tapped buttons when it is shown and spoken.
  const agreementOn = settings.spanishAgreement && !keepBaseForm;
  const formatSuggestion = useCallback(
    (text: string) => {
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean) : [];
      return composeMessage(viewBoard, words, uiLocale, { agreement: agreementOn }).text || text;
    },
    [viewBoard, uiLocale, agreementOn],
  );

  const applyPrediction = useCallback(
    (text: string) => {
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean) : [];
      setUtterance(words);
      if (!settings.whisperMode) speakText(formatSuggestion(text), speechLocale);
    },
    [formatSuggestion, settings.whisperMode, speechLocale],
  );

  const switchScanEnabled = settings.accessMode === 'switch' && !isEditor;
  const eyeDwellEnabled = settings.accessMode === 'eye-tracking' && !isEditor;
  const scanPaused = settings.pauseScanWhileSpeaking && speechActive;

  const { isHighlighted, isGroupHighlighted, scanBackActive, liveRef } = useSwitchScan({
    enabled: switchScanEnabled,
    paused: scanPaused,
    rows: board.grid.rows,
    columns: board.grid.columns,
    buttons: visibleButtons,
    intervalMs: settings.switchIntervalMs,
    order: settings.switchOrder,
    groupStrategy: settings.switchGroupStrategy,
    scanMode: settings.switchScanMode,
    groupCycles: settings.switchGroupCycles,
    firstItemHoldMs: settings.switchFirstItemHoldMs,
    acceptanceMs: settings.switchAcceptanceMs,
    postSelectionPauseMs: settings.switchPostSelectionPauseMs,
    auditoryHighlight: settings.auditoryScanHighlight,
    auditoryVoice: settings.auditoryScanVoice,
    auditoryBeep: settings.auditoryScanBeep,
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
    enabled: eyeDwellEnabled && settings.gazeSource === 'event-bridge',
    dwellMs: settings.eyeDwellMs,
    onActivate: (buttonId) => {
      const btn = visibleButtons.find((b) => (b.id as string) === buttonId);
      if (btn) activate(btn);
    },
  });

  const dwellProgressFor =
    settings.gazeSource === 'event-bridge' ? bridgeDwellProgress : pointerDwellProgress;

  const composed = composeMessage(viewBoard, utterance, uiLocale, { agreement: settings.spanishAgreement });

  const speakAll = useCallback(() => {
    speakWholeMessage(viewBoard, utterance, uiLocale, { agreement: agreementOn });
  }, [viewBoard, utterance, uiLocale, agreementOn]);

  const reportFailure = useCallback(
    (err: unknown) => dialogs.alert(tcx('actionFailed', { detail: (err as Error).message })),
    [dialogs, tcx],
  );

  // Plan board limit reached on import (402): explained with export/delete actions, not a generic error.
  const [importLimit, setImportLimit] = useState<{ limit?: number } | null>(null);

  // Imports always create a new board and open it; the board on screen is never replaced.
  const runImport = useCallback(
    async (format: BoardImportFormat, payload: string | ArrayBuffer) => {
      const beta = BETA_IMPORT_FORMATS.has(format);
      const confirmed = await dialogs.confirm(
        beta ? `${tcx('importBetaNotice')} ${tcx('importConfirm')}` : tcx('importConfirm'),
        { confirmLabel: tcx('importConfirmAction') },
      );
      if (!confirmed) return;
      setBusy(true);
      setImportLimit(null);
      try {
        const result = await importBoards(format, payload, contentLocaleForUi(uiLocale));
        const skipped = result.skipped.images + result.skipped.sounds;
        if (skipped > 0) void dialogs.alert(tcx('importSkippedMedia', { count: skipped }));
      } catch (err) {
        const failure = classifyImportFailure(err);
        if (failure.kind === 'board-limit') setImportLimit({ limit: failure.limit });
        else void reportFailure(err);
      } finally {
        setBusy(false);
      }
    },
    [dialogs, importBoards, reportFailure, tcx, uiLocale],
  );
  const handleImport = useCallback((raw: string) => runImport('obf', raw), [runImport]);
  const handleImportObz = useCallback((archive: ArrayBuffer) => runImport('obz', archive), [runImport]);
  const handleImportGridset = useCallback((archive: ArrayBuffer) => runImport('gridset', archive), [runImport]);
  const handleImportSnap = useCallback((archive: ArrayBuffer) => runImport('snap', archive), [runImport]);
  const handleImportTouchChat = useCallback((archive: ArrayBuffer) => runImport('touchchat', archive), [runImport]);

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
      void reportFailure(err);
    } finally {
      setBusy(false);
    }
  }, [exportObz, board.id, reportFailure]);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const json = await exportObf();
      downloadTextFile(`${board.id as string}.obf`, json);
    } catch (err) {
      void reportFailure(err);
    } finally {
      setBusy(false);
    }
  }, [exportObf, board.id, reportFailure]);

  const handleCreateBoard = useCallback(async () => {
    const name = await dialogs.prompt(tcx('boardNamePrompt'), { defaultValue: tcx('defaultBoardName') });
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await createBoard(name.trim(), newBoardTemplate || undefined, settings.contentLocale);
    } catch (err) {
      void reportFailure(err);
    } finally {
      setBusy(false);
    }
  }, [createBoard, dialogs, newBoardTemplate, reportFailure, settings.contentLocale, tcx]);

  // First-run setup: once per user and device, for a signed-in user with no
  // board yet, on the communicator screen only (never /app/edit or /demo).
  useEffect(() => {
    if (
      shouldOfferFirstRun({
        communicatorScreen: !remoteEditor,
        signedIn: isAuthenticated,
        catalogLoaded: catalogStatus === 'ready',
        catalog: boardCatalog,
        userId: sessionUserId,
        done: isFirstRunDone(sessionUserId),
      })
    ) {
      setFirstRunOpen(true);
    }
  }, [boardCatalog, catalogStatus, isAuthenticated, remoteEditor, sessionUserId]);

  const handleFirstRunCreate = useCallback(
    async (templateId: StarterTemplateId, contentLocale: string, name: string): Promise<FirstRunCreateResult> => {
      try {
        await createBoard(name, templateId, contentLocale);
        return { kind: 'created' };
      } catch (err) {
        if (err instanceof VoxaSyncError && err.status === 402) {
          // The plan's board limit: refresh the list so the setup offers the existing board.
          reloadCatalog();
          return { kind: 'board-limit' };
        }
        return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
      }
    },
    [createBoard, reloadCatalog],
  );

  const handleFirstRunClose = useCallback(
    (outcome: 'completed' | 'skipped') => {
      markFirstRunDone(sessionUserId, outcome);
      setFirstRunOpen(false);
    },
    [sessionUserId],
  );

  const handleRenameBoard = useCallback(async () => {
    const name = await dialogs.prompt(tcx('boardNamePrompt'), { defaultValue: board.name });
    if (!name?.trim() || name.trim() === board.name) return;
    setBusy(true);
    try {
      await renameBoard(name.trim());
    } catch (err) {
      void reportFailure(err);
    } finally {
      setBusy(false);
    }
  }, [board.name, dialogs, renameBoard, reportFailure, tcx]);

  const handleDuplicateBoard = useCallback(async () => {
    setBusy(true);
    try {
      await duplicateBoard();
    } catch (err) {
      void reportFailure(err);
    } finally {
      setBusy(false);
    }
  }, [duplicateBoard, reportFailure]);

  const handleDeleteBoard = useCallback(async () => {
    if (boardId === DEMO_BOARD_ID) {
      await dialogs.alert(tcx('demoCannotDelete'));
      return;
    }
    if (!(await dialogs.confirm(tcx('deleteConfirm', { name: board.name }), { confirmLabel: tcx('delete') }))) return;
    setBusy(true);
    try {
      await deleteBoard();
    } catch (err) {
      void reportFailure(err);
    } finally {
      setBusy(false);
    }
  }, [board.name, boardId, deleteBoard, dialogs, reportFailure, tcx]);

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
          void dialogs.alert(result.warnings.join('\n'));
        }
        setGridOpen(false);
      } catch (err) {
        void reportFailure(err);
      }
    },
    [board, dialogs, reportFailure, setBoard],
  );

  const handleRoleChange = useCallback(
    async (nextRole: TeamRole) => {
      if (nextRole === 'communicator') {
        lockEditorSession();
        setRole('communicator');
        setEditingId(null);
        return;
      }
      setBabbleActive(false);

      if (!canEnterEditor) return;
      // Account editors skip the device PIN; board owners and local users do not.
      const skipPin = trustedEditorSession;
      if (skipPin || !editorPinIsConfigured() || isEditorUnlocked()) {
        setRole(nextRole);
        return;
      }

      const pin = await dialogs.prompt(tcx('pinPrompt'), { secret: true });
      if (pin && (await unlockEditor(pin))) {
        setRole(nextRole);
        return;
      }

      if (pin) {
        await dialogs.alert(tcx('pinIncorrect'));
      }
    },
    [canEnterEditor, dialogs, tcx, trustedEditorSession],
  );

  const handleSave = useCallback(async () => {
    setBusy(true);
    try {
      const result = await saveBoard();
      if (result && 'conflict' in result) return;
    } catch (err) {
      void reportFailure(err);
    } finally {
      setBusy(false);
    }
  }, [reportFailure, saveBoard]);

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
    async (buttonId: string, row: number, column: number) => {
      try {
        const moving = board.grid.buttons.find((b) => (b.id as string) === buttonId);
        const target = board.grid.buttons.find(
          (b) => b.position.row === row && b.position.column === column,
        );
        const needsOverride = Boolean(
          moving?.locked || (target && target.locked && (target.id as string) !== buttonId),
        );
        const forceLocked =
          needsOverride && role === 'admin' && (await dialogs.confirm(tcx('overrideLockConfirm')));
        if (needsOverride && !forceLocked) {
          await dialogs.alert(tcx('slotLocked'));
          return;
        }
        if (forceLocked) markMotorPlanningOverride();
        const result = moveButtonToCell(board.grid.buttons, buttonId, row, column, {
          forceLocked: forceLocked || undefined,
        });
        setBoard({ ...board, grid: { ...board.grid, buttons: result.buttons } });
      } catch (err) {
        void reportFailure(err);
      }
    },
    [board, dialogs, markMotorPlanningOverride, reportFailure, role, setBoard, tcx],
  );

  useEffect(() => {
    setMovingId(null);
  }, [isEditor, boardId]);

  const completeMove = useCallback(
    async (row: number, column: number) => {
      const id = movingId;
      setMovingId(null);
      if (id) await handleGridDrop(id, row, column);
    },
    [handleGridDrop, movingId],
  );

  const moveBy = useCallback(
    (buttonId: string, rows: number, columns: number) => {
      const btn = board.grid.buttons.find((b) => (b.id as string) === buttonId);
      if (!btn) return;
      const row = btn.position.row + rows;
      const column = btn.position.column + columns;
      if (row < 0 || column < 0 || row >= board.grid.rows || column >= board.grid.columns) return;
      void handleGridDrop(buttonId, row, column);
    },
    [board, handleGridDrop],
  );

  const handleAddButtonAt = useCallback(
    async (row: number, column: number) => {
      const label = await dialogs.prompt(tcx('buttonLabelPrompt'));
      if (!label?.trim()) return;
      try {
        const buttons = createButtonAtCell(board.grid.buttons, row, column, label.trim());
        setBoard({ ...board, grid: { ...board.grid, buttons } });
      } catch (err) {
        void reportFailure(err);
      }
    },
    [board, dialogs, reportFailure, setBoard, tcx],
  );

  const theme = settings.cviTheme;
  const shellStyle = themeStyles(theme);
  const chrome = CVI_THEMES[theme].chrome;
  const syncLabel =
    syncStatus === 'live'
      ? pendingSave
        ? tcx('syncLiveQueued')
        : tcx('syncLive')
      : syncStatus === 'connecting'
        ? tcx('syncConnecting')
        : tcx('syncOffline');

  const handleButtonPress = (btn: BoardButton) => {
    if (isEditor && movingId) {
      void completeMove(btn.position.row, btn.position.column);
      return;
    }
    if (isEditor) {
      setEditingId(btn.id as string);
      return;
    }
    if (settings.accessMode === 'touch' && activatesOnPress(settings.touchActivation)) {
      activate(btn);
    }
  };

  const touchReleaseHandlers = (btn: BoardButton) => {
    if (isEditor || settings.accessMode !== 'touch' || !activatesOnRelease(settings.touchActivation)) {
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
        symbolUrl={buttonSymbolUrl(btn, symbolDefaults)}
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
        style={
          isEditor && movingId === (btn.id as string)
            ? { outline: `3px dashed ${brand.mid}`, outlineOffset: 2 }
            : revealedHidden
              ? { opacity: 0.72, outline: `2px dashed ${status.warningBorder}` }
              : undefined
        }
        aria-label={
          isEditor && btn.locked
            ? tb('buttonLocked', { label: buttonLabel(btn) })
            : revealedHidden
              ? tb('buttonHiddenBabble', { label: buttonLabel(btn) })
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
              color: brand.link,
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
            onAddButton={movingId ? (r, c) => void completeMove(r, c) : handleAddButtonAt}
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
      {dialogs.dialog}
      {firstRunOpen ? (
        <FirstRunSetup
          settings={settings}
          onChange={setSettings}
          deviceVoices={deviceVoices}
          existingBoard={existingBoardFor(boardCatalog, sessionUserId)}
          onCreate={handleFirstRunCreate}
          onOpenBoard={setBoardId}
          onClose={handleFirstRunClose}
        />
      ) : null}
      <div ref={liveRef} aria-live="polite" aria-atomic="true" style={visuallyHidden} />

      {remoteEditor ? (
        <div
          style={{
            padding: '10px 16px',
            background: brand.surfaceTint,
            color: brand.onSurfaceTint,
            borderBottom: `1px solid ${brand.primaryStrong}`,
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          {!canEnterEditor ? (
            <>{tcx('remoteDemoReadOnly')}</>
          ) : ownBoard && !trustedEditorSession && !isEditor ? (
            <>
              {tcx('remoteOwnBoard')}{' '}
              <button type="button" onClick={() => void handleRoleChange('editor')} style={secondaryBtn}>
                {tcx('editMyBoard')}
              </button>
            </>
          ) : accountCanEdit ? (
            <>
              <strong>{tcx('remoteEditorTitle')}</strong> {tcx('remoteEditorBody')}
            </>
          ) : isAuthenticated ? (
            <>{tcx('remoteNoPermission')}</>
          ) : (
            <>
              {tcx('remoteSignInPrompt')}{' '}
              <a href="/auth/signin?redirect_to=%2Fapp%2Fedit" style={{ color: brand.link }}>
                {tcx('signIn')}
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
            aria-label={tcx('boardSelect')}
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

        {isAuthenticated && (isEditor || !canEnterEditor) && (
          <>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
              {tcx('template')}
              <select
                value={newBoardTemplate}
                onChange={(e) => setNewBoardTemplate(e.target.value as '' | StarterTemplateId)}
                style={{ background: surface.overlay, color: neutral.textSubtle, border: `1px solid ${neutral.border}`, borderRadius: 6 }}
              >
                <option value="">{tcx('templateBlank')}</option>
                <option value="core-24">{tcx('templateCore24')}</option>
                <option value="core-36">{tcx('templateCore36')}</option>
                <option value="core-60">{tcx('templateCore60')}</option>
                <option value="core-47">{tcx('templateCore47')}</option>
                <option value="core-100">{tcx('templateCore100')}</option>
                <option value="literacy-keyboard">{tcx('templateLiteracyKeyboard')}</option>
                <option value="visual-schedule">{tcx('templateVisualSchedule')}</option>
              </select>
            </label>
            <button type="button" onClick={() => void handleCreateBoard()} disabled={busy} style={secondaryBtn}>
              {tcx('newBoard')}
            </button>
            {isEditor ? (
              <>
                <button type="button" onClick={() => void handleRenameBoard()} disabled={busy} style={secondaryBtn}>
                  {tcx('rename')}
                </button>
                <button type="button" onClick={() => void handleDuplicateBoard()} disabled={busy} style={secondaryBtn}>
                  {tcx('duplicate')}
                </button>
              </>
            ) : null}
            {isEditor && boardId !== DEMO_BOARD_ID ? (
              <button type="button" onClick={() => void handleDeleteBoard()} disabled={busy} style={secondaryBtn}>
                {tcx('delete')}
              </button>
            ) : null}
          </>
        )}

        <span
          style={{
            fontSize: '0.75rem',
            color: syncStatus === 'live' ? chrome.statusLive : CVI_THEMES[theme].foreground,
          }}
        >
          {syncLabel} v{board.version}
        </span>

        <select
          value={role}
          onChange={(e) => void handleRoleChange(e.target.value as TeamRole)}
          style={selectStyle}
          aria-label={tcx('teamRole')}
          disabled={remoteEditor || !canEnterEditor}
          title={canEnterEditor ? undefined : tcx('demoReadOnlyShort')}
        >
          <option value="communicator">{tcx('roleCommunicator')}</option>
          <option value="editor">{tcx('roleEditor')}</option>
          <option value="admin">{tcx('admin')}</option>
        </select>

        {remoteEditor ? (
          <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{tcx('roleFromAccount')}</span>
        ) : null}

        {!isEditor ? (
          <button
            type="button"
            onClick={() => setBabbleActive((active) => !active)}
            style={{
              ...secondaryBtn,
              background: babbleActive ? status.warningFill : secondaryBtn.background,
              borderColor: babbleActive ? status.warningBorder : neutral.border,
            }}
            aria-pressed={babbleActive}
          >
            {tcx('babble')}
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
          {tc('settings')}
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
              {tcx('auditLog')}
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
              {tcx('usage')}
            </button>
          </>
        ) : null}

        {!isAuthenticated ? (
          <a
            href={remoteEditor ? '/auth/signin?redirect_to=%2Fapp%2Fedit' : '/auth/signin?redirect_to=%2Fapp'}
            style={{ ...secondaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            {tcx('signIn')}
          </a>
        ) : null}

        {isAuthenticated && (
          <a href="/auth/signout" style={{ ...secondaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            {tcx('signOut')}
          </a>
        )}

        <div
          data-voxa-message-bar=""
          style={{
            ...utteranceBarStyle,
            background: chrome.messageBarBackground,
            color: chrome.messageBarForeground,
            border: `1px solid ${chrome.messageBarBorder}`,
          }}
        >
          {scheduleMode && !isEditor
            ? scheduleState.completed >= scheduleState.total && scheduleState.total > 0
              ? tcx('routineComplete')
              : tcx('scheduleStep', {
                  current: Math.min(scheduleState.completed + 1, scheduleState.total),
                  total: scheduleState.total,
                })
            : literacyMode
              ? formatKeyboardUtterance(utterance) || tcx('typeOnKeyboard')
              : utterance.length
                ? keepBaseForm
                  ? composed.baseText
                  : composed.text
                : tcx('tapToBuild')}
        </div>

        {composed.agreementApplied && !literacyMode && !scheduleMode ? (
          <button
            type="button"
            onClick={() => setKeepBaseForm((value) => !value)}
            style={secondaryBtn}
            aria-pressed={keepBaseForm}
            title={keepBaseForm ? composed.text : composed.baseText}
          >
            {tcx('keepBaseForm')}
          </button>
        ) : null}

        <button type="button" onClick={speakAll} style={headerBtn}>
          {tc('speak')}
        </button>
        <button
          type="button"
          onClick={() => {
            setUtterance([]);
            setKeepBaseForm(false);
            setCompletedStepIds(new Set());
          }}
          style={headerBtn}
        >
          {tc('clear')}
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
              {tcx('gridSettings')}
            </button>
            <button type="button" onClick={openObfImport} disabled={busy} style={secondaryBtn}>
              {tcx('importObf')}
            </button>
            <button type="button" onClick={openObzImport} disabled={busy} style={secondaryBtn}>
              {tcx('importObz')}
            </button>
            <button type="button" onClick={openGridsetImport} disabled={busy} style={secondaryBtn} title={tcx('importBetaNotice')}>
              {tcx('importGrid')}
            </button>
            <button type="button" onClick={openSnapImport} disabled={busy} style={secondaryBtn} title={tcx('importBetaNotice')}>
              {tcx('importSnap')}
            </button>
            <button type="button" onClick={openTouchChatImport} disabled={busy} style={secondaryBtn} title={tcx('importBetaNotice')}>
              {tcx('importTouchChat')}
            </button>
            <button type="button" onClick={handleExport} disabled={busy} style={secondaryBtn}>
              {tcx('exportObf')}
            </button>
            <button type="button" onClick={() => void handleExportObz()} disabled={busy} style={secondaryBtn}>
              {tcx('exportObz')}
            </button>
            <button type="button" onClick={handleSave} disabled={busy} style={secondaryBtn}>
              {tc('save')}
            </button>
          </>
        )}
      </header>

      {babbleActive && !isEditor ? (
        <div
          style={{
            background: status.warningFill,
            color: status.warningText,
            padding: '6px 16px',
            fontSize: '0.8125rem',
          }}
        >
          {tcx('babbleBanner')}
        </div>
      ) : null}

      {importLimit ? (
        <ImportLimitNotice
          limit={importLimit.limit}
          canDelete={accountCanEdit}
          busy={busy}
          onExportObf={() => void handleExport()}
          onExportObz={() => void handleExportObz()}
          onDelete={() => {
            setImportLimit(null);
            void handleDeleteBoard();
          }}
          onClose={() => setImportLimit(null)}
        />
      ) : null}

      {missingVoiceNotice ? (
        <VoiceMissingNotice
          fallbackName={missingVoiceNotice.fallbackName}
          onDismiss={dismissMissingVoiceNotice}
        />
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
            background: surface.raised,
            color: neutral.muted,
            padding: '6px 16px',
            fontSize: '0.8125rem',
          }}
        >
          {tcx('editorHint')}
        </div>
      ) : null}

      {!isEditor && !scheduleMode && (
        <PredictionStrip
          textPredictions={textPredictions}
          symbolPredictions={symbolPredictions}
          buttons={sorted}
          onApplyText={applyPrediction}
          formatText={formatSuggestion}
          onSelectSymbol={activate}
        />
      )}

      {isEditor && movingId ? (
        <MoveModeBanner
          label={buttonLabel(sorted.find((b) => (b.id as string) === movingId) ?? sorted[0]!)}
          onCancel={() => setMovingId(null)}
        />
      ) : null}

      {switchScanEnabled && settings.switchGroupStrategy !== 'none' ? (
        <ScanBackTarget active={scanBackActive} />
      ) : null}

      <main style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
          {scheduleMode ? (
            <>
              <VisualScheduleView
                steps={scheduleSteps.filter((btn) => isButtonVisible(btn))}
                completedIds={completedStepIds}
                currentStepId={scheduleState.currentStepId}
                targetScale={settings.targetScale}
                hideSymbol={displaySettings.hideSymbols}
                hideLabel={displaySettings.hideLabels}
                isHighlighted={isHighlighted}
                isGroupHighlighted={isGroupHighlighted}
                dwellProgressFor={dwellProgressFor}
                renderStepButton={(btn, state) => {
                  const revealedHidden = babbleActive && !isEditor && btn.hidden;
                  return (
                    <AacButton
                      label={buttonLabel(btn)}
                      data-voxa-button-id={btn.id as string}
                      symbolUrl={buttonSymbolUrl(btn, symbolDefaults)}
                      borderColor={buttonBorderColor(btn)}
                      targetScale={settings.targetScale}
                      hideSymbol={displaySettings.hideSymbols}
                      hideLabel={displaySettings.hideLabels}
                      scanHighlighted={isHighlighted(btn)}
                      scanGroupHighlighted={isGroupHighlighted(btn)}
                      dwellProgress={dwellProgressFor(btn.id as string)}
                      onClick={() => handleButtonPress(btn)}
                      {...touchReleaseHandlers(btn)}
                      onPointerEnter={() => onEnter(btn.id as string)}
                      onPointerLeave={onLeave}
                      style={
                        revealedHidden
                          ? { opacity: 0.72, outline: `2px dashed ${status.warningBorder}` }
                          : state.completed
                            ? { opacity: 0.72, outline: `2px solid ${status.successBorder}` }
                            : state.current
                              ? { outline: `2px solid ${status.warningAccent}` }
                              : undefined
                      }
                      aria-label={
                        isEditor && btn.locked
                          ? tb('buttonLocked', { label: buttonLabel(btn) })
                          : state.completed
                            ? tb('stepCompleted', { label: buttonLabel(btn) })
                            : state.current
                              ? tb('stepCurrent', { label: buttonLabel(btn) })
                              : buttonLabel(btn)
                      }
                    >
                      {isEditor && btn.locked ? (
                        <span
                          aria-hidden
                          style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.75rem', lineHeight: 1 }}
                        >
                          🔒
                        </span>
                      ) : null}
                    </AacButton>
                  );
                }}
              />
              {touchGuardOn ? (
                <TouchGuardListOverlay
                  stepCount={scheduleSteps.filter((btn) => isButtonVisible(btn)).length}
                  mask={settings.touchGuardMask}
                />
              ) : null}
            </>
          ) : (
            <>
              <BoardGrid
                ariaLabel={tb('gridLabel')}
                rows={board.grid.rows}
                columns={board.grid.columns}
                theme={theme}
                targetScale={settings.targetScale}
              >
                {gridCells}
              </BoardGrid>
              {touchGuardOn ? (
                <TouchGuardOverlay
                  rows={board.grid.rows}
                  columns={board.grid.columns}
                  mask={settings.touchGuardMask}
                />
              ) : null}
            </>
          )}
        </div>

        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            onClose={() => setSettingsOpen(false)}
            showEditorPinSettings={role === 'admin'}
            boardDisplay={board.display}
            onBoardDisplayChange={isEditor ? handleBoardDisplayChange : undefined}
            accessToken={accessToken}
            speechLocale={speechLocale}
            deviceVoices={deviceVoices}
            onOpenFirstRun={
              !remoteEditor && isAuthenticated
                ? () => {
                    setSettingsOpen(false);
                    setFirstRunOpen(true);
                  }
                : undefined
            }
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
            defaultSymbolSkinTone={settings.defaultSymbolSkinTone}
            contentLocale={settings.contentLocale}
            onClose={() => setEditingId(null)}
            onChange={(patch) => updateButton(editingId, patch)}
            moveControls={
              <ButtonMoveControls
                moving={movingId === editingId}
                onStartMove={() => {
                  const locked = sorted.find((b) => (b.id as string) === editingId)?.locked;
                  if (locked && role !== 'admin') void dialogs.alert(tcx('slotLocked'));
                  else setMovingId(editingId);
                }}
                onCancelMove={() => setMovingId(null)}
                onMoveBy={(rows, columns) => moveBy(editingId, rows, columns)}
              />
            }
          />
        )}
      </main>

      <footer
        style={{
          padding: '10px 16px',
          fontSize: '0.75rem',
          color: chrome.muted,
          borderTop: `1px solid ${surface.overlay}`,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Link href="/legal/privacy" style={{ color: chrome.link }}>
          {tn('privacy')}
        </Link>
        <Link href="/legal/terms" style={{ color: chrome.link }}>
          {tn('terms')}
        </Link>
        <Link href="/legal/accessibility" style={{ color: chrome.link }}>
          {tn('accessibility')}
        </Link>
        <SymbolCredit buttons={visibleButtons} hidden={literacyDisplay.hideSymbols} />
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
  defaultSymbolSkinTone,
  contentLocale,
  onClose,
  onChange,
  moveControls,
}: {
  button: BoardButton;
  boardId: string;
  boardCatalog: BoardSummary[];
  accessToken?: string;
  recordedBy: string;
  defaultSymbolSkinTone: CommunicatorSettings['defaultSymbolSkinTone'];
  contentLocale: CommunicatorSettings['contentLocale'];
  onClose: () => void;
  onChange: (patch: Partial<BoardButton>) => void;
  moveControls?: React.ReactNode;
}) {
  const te = useTranslations('editor');
  const label = button.kind === 'analytic' ? button.label : button.phrase;
  const speech = button.kind === 'analytic' ? button.speechText : button.phrase;
  const fieldsLocked = button.locked;

  return (
    <aside
      style={{
        width: 280,
        background: surface.section,
        color: neutral.textSubtle,
        borderLeft: `1px solid ${neutral.borderSubtle}`,
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <h2 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{te('title')}</h2>

      {moveControls}

      <SymbolSearchPanel
        boardId={boardId}
        accessToken={accessToken}
        contentLocale={contentLocale}
        currentUrl={buttonSymbolUrl(button, { skinTone: defaultSymbolSkinTone })}
        symbolUnavailable={buttonSymbolUnavailable(button)}
        disabled={fieldsLocked}
        onSelect={(selection) =>
          onChange({
            symbolUrl: selection.imageUrl,
            symbolRef: selection.symbolRef,
          })
        }
        onClear={() => onChange({ symbolUrl: undefined, symbolRef: undefined })}
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
        {te('linkToBoard')}
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
          <option value="">{te('linkNone')}</option>
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
        <p style={{ fontSize: '0.8125rem', color: status.warningText, margin: '0 0 12px' }}>
          {te('slotLockedHint')}
        </p>
      ) : null}

      <label style={labelStyle}>
        {te('label')}
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
          {te('speech')}
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
        {te('partOfSpeech')}
        <select
          style={fieldStyle}
          value={button.partOfSpeech ?? 'noun'}
          disabled={fieldsLocked}
          onChange={(e) => onChange({ partOfSpeech: e.target.value as PartOfSpeechTag })}
        >
          {posOptions().map((pos) => (
            <option key={pos} value={pos}>
              {te(`pos.${pos}`)} ({fitzgeraldColor(pos as PartOfSpeech)})
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
        {te('lockPosition')}
      </label>

      <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={button.hidden ?? false}
          disabled={fieldsLocked}
          onChange={(e) => onChange({ hidden: e.target.checked })}
        />
        {te('hideFromCommunicator')}
      </label>

      <button type="button" onClick={onClose} style={{ ...headerBtn, marginTop: 16, width: '100%' }}>
        {te('done')}
      </button>
    </aside>
  );
}

const selectStyle: React.CSSProperties = {
  background: surface.raised,
  color: neutral.textSubtle,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  padding: '6px 8px',
  minHeight: 38,
};

const utteranceBarStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 200,
  minHeight: 40,
  background: surface.raised,
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
  background: surface.base,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  color: neutral.textSubtle,
  padding: '8px 10px',
};
