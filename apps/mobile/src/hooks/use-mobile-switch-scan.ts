'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { BoardButton } from '@voxa/core';
import {
  buildGridScanPath,
  buildGroupCellPath,
  cellKey,
  clampSwitchInterval,
  groupScanLabel,
  resolveScanGroups,
  type ScanOrder,
  type SwitchGroupStrategy,
} from '@voxa/access';
import { buttonLabel } from '@/lib/board-utils';
import { speakText } from '@/lib/play-button-speech';

interface UseMobileSwitchScanOptions {
  enabled: boolean;
  rows: number;
  columns: number;
  buttons: BoardButton[];
  intervalMs: number;
  order: ScanOrder;
  groupStrategy: SwitchGroupStrategy;
  auditoryHighlight: boolean;
  auditoryVoice: boolean;
  onSelect: (button: BoardButton) => void;
}

function findButtonAt(buttons: BoardButton[], row: number, column: number): BoardButton | undefined {
  return buttons.find((b) => b.position.row === row && b.position.column === column);
}

export function useMobileSwitchScan({
  enabled,
  rows,
  columns,
  buttons,
  intervalMs,
  order,
  groupStrategy,
  auditoryHighlight,
  auditoryVoice,
  onSelect,
}: UseMobileSwitchScanOptions) {
  const groups = useMemo(
    () => resolveScanGroups(rows, columns, groupStrategy),
    [rows, columns, groupStrategy],
  );
  const linearPath = useMemo(() => buildGridScanPath(rows, columns, order), [rows, columns, order]);

  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'groups' | 'cells'>('groups');
  const [groupStep, setGroupStep] = useState(0);
  const [cellStep, setCellStep] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    setPhase('groups');
    setStep(0);
    setGroupStep(0);
    setCellStep(0);
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

  const activeLabel = groups
    ? phase === 'groups' && activeGroup
      ? groupScanLabel(activeGroupIndex, groupStrategy, activeGroup)
      : activeButton
        ? buttonLabel(activeButton)
        : ''
    : activeButton
      ? buttonLabel(activeButton)
      : '';

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
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
    return () => clearInterval(id);
  }, [enabled, intervalMs, groups, phase]);

  useEffect(() => {
    if (!enabled || !auditoryHighlight || !activeLabel) return;
    void AccessibilityInfo.announceForAccessibility(activeLabel);
  }, [enabled, auditoryHighlight, activeLabel, step, groupStep, cellStep, phase]);

  useEffect(() => {
    if (!enabled || !auditoryVoice || !activeLabel) return;
    if (groups && phase === 'groups') {
      speakText(activeLabel);
      return;
    }
    if (activeButton) speakText(buttonLabel(activeButton), activeButton.locale);
  }, [enabled, auditoryVoice, activeLabel, activeButton, phase, groups, step, groupStep, cellStep]);

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

  return {
    isHighlighted,
    isGroupHighlighted,
    advance,
    select,
    activeLabel,
    scanPhase: groups ? phase : ('cells' as const),
  };
}
