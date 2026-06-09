'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardButton } from '@voxa/core';
import {
  buildGridScanPath,
  buildGroupCellPath,
  cellKey,
  clampSwitchInterval,
  classifySwitchKey,
  groupScanLabel,
  playScanBeepInBrowser,
  resolveScanGroups,
  SCAN_GROUP_BEEP,
  SCAN_STEP_BEEP,
  type ScanOrder,
  type SwitchGroupStrategy,
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
  auditoryHighlight: boolean;
  auditoryVoice?: boolean;
  auditoryBeep?: boolean;
  onSelect: (button: BoardButton) => void;
  getLabel: (button: BoardButton) => string;
}

function findButtonAt(buttons: BoardButton[], row: number, column: number): BoardButton | undefined {
  return buttons.find((b) => b.position.row === row && b.position.column === column);
}

export function useSwitchScan({
  enabled,
  paused = false,
  rows,
  columns,
  buttons,
  intervalMs,
  order,
  groupStrategy,
  auditoryHighlight,
  auditoryVoice = false,
  auditoryBeep = true,
  onSelect,
  getLabel,
}: UseSwitchScanOptions) {
  const groups = useMemo(
    () => resolveScanGroups(rows, columns, groupStrategy),
    [rows, columns, groupStrategy],
  );
  const linearPath = useMemo(() => buildGridScanPath(rows, columns, order), [rows, columns, order]);

  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'groups' | 'cells'>('groups');
  const [groupStep, setGroupStep] = useState(0);
  const [cellStep, setCellStep] = useState(0);
  const liveRef = useRef<HTMLDivElement>(null);
  const beepReadyRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      beepReadyRef.current = false;
      return;
    }
    setPhase('groups');
    setStep(0);
    setGroupStep(0);
    setCellStep(0);
    beepReadyRef.current = false;
  }, [enabled, rows, columns, order, groupStrategy]);

  const activeGroupIndex = groups ? groupStep % groups.length : 0;
  const activeGroup = groups?.[activeGroupIndex];
  const cellPath = useMemo(
    () => (activeGroup ? buildGroupCellPath(activeGroup, rows, columns, order) : []),
    [activeGroup, rows, columns, order],
  );

  const activeCell = groups
    ? phase === 'cells'
      ? cellPath[cellStep % Math.max(cellPath.length, 1)]
      : undefined
    : linearPath[step % linearPath.length];

  const activeButton = activeCell ? findButtonAt(buttons, activeCell.row, activeCell.column) : undefined;

  const activeGroupKeys = useMemo(
    () => new Set(activeGroup?.map(cellKey) ?? []),
    [activeGroup],
  );

  const scanAnnouncement = groups
    ? phase === 'groups' && activeGroup
      ? groupScanLabel(activeGroupIndex, groupStrategy, activeGroup)
      : activeButton
        ? getLabel(activeButton)
        : ''
    : activeButton
      ? getLabel(activeButton)
      : '';

  const advance = useCallback(() => {
    if (groups) {
      if (phase === 'groups') {
        setGroupStep((s) => s + 1);
        return;
      }
      setCellStep((s) => s + 1);
      return;
    }
    setStep((s) => s + 1);
  }, [groups, phase]);

  const select = useCallback(() => {
    if (groups) {
      if (phase === 'groups') {
        setPhase('cells');
        setCellStep(0);
        return;
      }
      if (activeButton) onSelect(activeButton);
      setPhase('groups');
      return;
    }
    if (activeButton) onSelect(activeButton);
  }, [groups, phase, activeButton, onSelect]);

  useEffect(() => {
    if (!enabled || paused) return;

    const id = window.setInterval(() => {
      if (groups) {
        if (phase === 'groups') {
          setGroupStep((s) => s + 1);
        } else {
          setCellStep((s) => s + 1);
        }
        return;
      }
      setStep((s) => s + 1);
    }, clampSwitchInterval(intervalMs));

    return () => window.clearInterval(id);
  }, [enabled, paused, intervalMs, groups, phase]);

  useEffect(() => {
    if (!enabled || !auditoryHighlight || !scanAnnouncement || !liveRef.current) return;
    liveRef.current.textContent = scanAnnouncement;
  }, [enabled, auditoryHighlight, scanAnnouncement, step, groupStep, cellStep, phase]);

  useEffect(() => {
    if (!enabled || !auditoryVoice || !scanAnnouncement) return;
    if (groups && phase === 'groups') {
      announceScanLabel(scanAnnouncement);
      return;
    }
    if (activeButton) {
      announceScanLabel(getLabel(activeButton), activeButton.locale);
    }
  }, [enabled, auditoryVoice, scanAnnouncement, activeButton, phase, groups, getLabel, step, groupStep, cellStep]);

  useEffect(() => {
    if (!enabled || paused || !auditoryBeep) return;
    if (!beepReadyRef.current) {
      beepReadyRef.current = true;
      return;
    }
    playScanBeepInBrowser(groups && phase === 'groups' ? SCAN_GROUP_BEEP : SCAN_STEP_BEEP);
  }, [enabled, paused, auditoryBeep, step, groupStep, cellStep, phase, groups]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const action = classifySwitchKey(e.code);
      if (action === 'select') {
        e.preventDefault();
        select();
        return;
      }
      if (action === 'advance') {
        e.preventDefault();
        advance();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, select, advance]);

  useEffect(() => {
    if (!enabled || typeof navigator.getGamepads !== 'function') return;

    const pressed = new Map<number, boolean>();
    let frame = 0;

    const poll = () => {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad) continue;
        for (const buttonIndex of [0, 1]) {
          const down = pad.buttons[buttonIndex]?.pressed ?? false;
          const wasDown = pressed.get(buttonIndex) ?? false;
          if (down && !wasDown) {
            if (buttonIndex === 0) select();
            else advance();
          }
          pressed.set(buttonIndex, down);
        }
      }
      frame = window.requestAnimationFrame(poll);
    };

    frame = window.requestAnimationFrame(poll);
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, select, advance]);

  const isGroupHighlighted = useCallback(
    (button: BoardButton) =>
      enabled &&
      groups !== null &&
      phase === 'groups' &&
      activeGroupKeys.has(cellKey(button.position)),
    [enabled, groups, phase, activeGroupKeys],
  );

  const isHighlighted = useCallback(
    (button: BoardButton) =>
      enabled &&
      activeCell !== undefined &&
      button.position.row === activeCell.row &&
      button.position.column === activeCell.column,
    [enabled, activeCell],
  );

  return { isHighlighted, isGroupHighlighted, advance, select, liveRef, scanPhase: groups ? phase : 'cells' as const };
}
