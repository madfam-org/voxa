'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { contentLocaleForUi, DEFAULT_UI_LOCALE, isUiLocale } from '@voxa/i18n';
import type { BoardButton } from '@voxa/core';
import {
  applyScanInput,
  attachBrowserHardwareSwitch,
  cellKey,
  clampSwitchInterval,
  createScanMachine,
  groupScanLabel,
  playScanBeepInBrowser,
  scanStepDelay,
  SCAN_GROUP_BEEP,
  SCAN_STEP_BEEP,
  type GroupScanLabels,
  type ScanInput,
  type ScanOrder,
  type ScanState,
  type SwitchGroupStrategy,
  type SwitchScanMode,
} from '@voxa/access';
import { announceScanLabel } from '@/lib/play-button-speech';

interface UseSwitchScanOptions {
  enabled: boolean;
  paused?: boolean;
  rows: number;
  columns: number;
  buttons: BoardButton[];
  intervalMs: number;
  order: ScanOrder;
  groupStrategy: SwitchGroupStrategy;
  /** 'auto' (timer moves, one switch) or 'step' (switch 1 moves, switch 2 selects). */
  scanMode?: SwitchScanMode;
  /** Full cycles inside a group without a selection before returning to group level. */
  groupCycles?: number;
  firstItemHoldMs?: number;
  acceptanceMs?: number;
  postSelectionPauseMs?: number;
  auditoryHighlight: boolean;
  auditoryVoice?: boolean;
  auditoryBeep?: boolean;
  onSelect: (button: BoardButton) => void;
  getLabel: (button: BoardButton) => string;
}

function findButtonAt(buttons: BoardButton[], row: number, column: number): BoardButton | undefined {
  return buttons.find((b) => b.position.row === row && b.position.column === column);
}

/**
 * Switch scanning for the board, driven by the pure state machine in
 * `@voxa/access` (`createScanMachine`): empty cells are skipped, group scans
 * offer a "back" position and return to the group level after
 * `groupCycles` full cycles, step scan moves only on switch 1.
 */
export function useSwitchScan({
  enabled,
  paused = false,
  rows,
  columns,
  buttons,
  intervalMs,
  order,
  groupStrategy,
  scanMode = 'auto',
  groupCycles = 2,
  firstItemHoldMs = 0,
  acceptanceMs = 0,
  postSelectionPauseMs = 0,
  auditoryHighlight,
  auditoryVoice = false,
  auditoryBeep = true,
  onSelect,
  getLabel,
}: UseSwitchScanOptions) {
  const ts = useTranslations('scan');
  // Group and "back" announcements are UI text: speak them in the UI's language.
  const uiLocale = useLocale();
  const announcementLocale = contentLocaleForUi(isUiLocale(uiLocale) ? uiLocale : DEFAULT_UI_LOCALE);
  const groupLabels = useMemo<GroupScanLabels>(
    () => ({
      row: (n) => ts('row', { n }),
      regions: [ts('topLeft'), ts('topRight'), ts('bottomLeft'), ts('bottomRight')],
      region: (n) => ts('region', { n }),
      group: (n) => ts('group', { n }),
    }),
    [ts],
  );

  const occupiedKey = useMemo(
    () => buttons.map((b) => cellKey(b.position)).sort().join('|'),
    [buttons],
  );
  const machine = useMemo(
    () =>
      createScanMachine({
        rows,
        columns,
        order,
        groupStrategy,
        groupCycles,
        occupied: new Set(occupiedKey ? occupiedKey.split('|') : []),
      }),
    [rows, columns, order, groupStrategy, groupCycles, occupiedKey],
  );

  const [state, setState] = useState<ScanState>(() => machine.initial());
  const stateRef = useRef(state);
  stateRef.current = state;
  const [selectionPaused, setSelectionPaused] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);
  const beepReadyRef = useRef(false);
  // Read through refs so a re-render (new arrays) never restarts the scan timer.
  const buttonsRef = useRef(buttons);
  buttonsRef.current = buttons;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const fresh = machine.initial();
    stateRef.current = fresh;
    setState(fresh);
    setSelectionPaused(false);
    beepReadyRef.current = false;
  }, [enabled, machine]);

  const highlight = machine.highlight(state);
  const activeCell = highlight.kind === 'cell' ? highlight.cell : undefined;
  const activeButton = activeCell ? findButtonAt(buttons, activeCell.row, activeCell.column) : undefined;
  const activeGroupKeys = new Set(highlight.kind === 'group' ? highlight.cells.map(cellKey) : []);

  const scanAnnouncement =
    highlight.kind === 'group'
      ? groupScanLabel(
          machine.groupSourceIndices[highlight.groupIndex] ?? highlight.groupIndex,
          groupStrategy,
          highlight.cells,
          groupLabels,
        )
      : highlight.kind === 'back'
        ? ts('back')
        : activeButton
          ? getLabel(activeButton)
          : '';

  const handleInput = useCallback(
    (input: ScanInput) => {
      if (!enabled || selectionPaused) return;
      const result = applyScanInput(machine, scanMode, stateRef.current, input);
      stateRef.current = result.state;
      setState(result.state);
      if (!result.selected) return;
      const button = findButtonAt(buttonsRef.current, result.selected.row, result.selected.column);
      if (button) onSelectRef.current(button);
      if (postSelectionPauseMs > 0) setSelectionPaused(true);
    },
    [enabled, selectionPaused, machine, scanMode, postSelectionPauseMs],
  );

  const advance = useCallback(() => handleInput('advance'), [handleInput]);
  const select = useCallback(() => handleInput('select'), [handleInput]);

  useEffect(() => {
    if (!selectionPaused) return;
    const id = window.setTimeout(() => setSelectionPaused(false), postSelectionPauseMs);
    return () => window.clearTimeout(id);
  }, [selectionPaused, postSelectionPauseMs]);

  // Auto scan: one timed step at a time; the first item of a level is held longer.
  useEffect(() => {
    if (!enabled || paused || selectionPaused || scanMode !== 'auto' || machine.empty) return;
    const delay = scanStepDelay(state, clampSwitchInterval(intervalMs), firstItemHoldMs);
    const id = window.setTimeout(() => handleInput('tick'), delay);
    return () => window.clearTimeout(id);
  }, [enabled, paused, selectionPaused, scanMode, machine, state, intervalMs, firstItemHoldMs, handleInput]);

  useEffect(() => {
    if (!enabled || !auditoryHighlight || !scanAnnouncement || !liveRef.current) return;
    liveRef.current.textContent = scanAnnouncement;
  }, [enabled, auditoryHighlight, scanAnnouncement, state]);

  useEffect(() => {
    if (!enabled || !auditoryVoice || !scanAnnouncement) return;
    if (activeButton) {
      announceScanLabel(getLabel(activeButton), activeButton.locale);
      return;
    }
    announceScanLabel(scanAnnouncement, announcementLocale);
    // `state` re-announces when the scan lands on the same label again.
  }, [enabled, auditoryVoice, scanAnnouncement, activeButton, getLabel, state, announcementLocale]);

  useEffect(() => {
    if (!enabled || paused || !auditoryBeep) return;
    if (!beepReadyRef.current) {
      beepReadyRef.current = true;
      return;
    }
    playScanBeepInBrowser(state.level === 'groups' ? SCAN_GROUP_BEEP : SCAN_STEP_BEEP);
  }, [enabled, paused, auditoryBeep, state]);

  useEffect(() => {
    return attachBrowserHardwareSwitch({
      enabled,
      acceptanceMs,
      onAdvance: advance,
      onSelect: select,
    });
  }, [enabled, acceptanceMs, advance, select]);

  const isGroupHighlighted = (button: BoardButton) =>
    enabled && activeGroupKeys.has(cellKey(button.position));

  const isHighlighted = useCallback(
    (button: BoardButton) =>
      enabled &&
      activeCell !== undefined &&
      button.position.row === activeCell.row &&
      button.position.column === activeCell.column,
    [enabled, activeCell],
  );

  return {
    isHighlighted,
    isGroupHighlighted,
    /** The group's "back" position is highlighted (render a visible back target). */
    scanBackActive: enabled && highlight.kind === 'back',
    advance,
    select,
    liveRef,
    scanPhase: state.level === 'groups' ? ('groups' as const) : ('cells' as const),
  };
}
