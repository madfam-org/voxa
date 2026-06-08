'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { BoardButton } from '@voxa/core';
import { buildGridScanPath, clampSwitchInterval, type ScanOrder } from '@voxa/access';
import { buttonLabel } from '@/lib/board-utils';
import { speakText } from '@/lib/play-button-speech';

interface UseMobileSwitchScanOptions {
  enabled: boolean;
  rows: number;
  columns: number;
  buttons: BoardButton[];
  intervalMs: number;
  order: ScanOrder;
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
  auditoryHighlight,
  auditoryVoice,
  onSelect,
}: UseMobileSwitchScanOptions) {
  const scanPath = useMemo(() => buildGridScanPath(rows, columns, order), [rows, columns, order]);
  const [step, setStep] = useState(0);

  const activeCell = scanPath[step % scanPath.length];
  const activeButton = activeCell ? findButtonAt(buttons, activeCell.row, activeCell.column) : undefined;

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setStep((s) => s + 1), clampSwitchInterval(intervalMs));
    return () => clearInterval(id);
  }, [enabled, intervalMs]);

  useEffect(() => {
    if (!enabled || !auditoryHighlight || !activeButton) return;
    void AccessibilityInfo.announceForAccessibility(buttonLabel(activeButton));
  }, [enabled, auditoryHighlight, activeButton, step]);

  useEffect(() => {
    if (!enabled || !auditoryVoice || !activeButton) return;
    speakText(buttonLabel(activeButton), activeButton.locale);
  }, [enabled, auditoryVoice, activeButton, step]);

  const advance = useCallback(() => {
    setStep((s) => s + 1);
  }, []);

  const select = useCallback(() => {
    if (activeButton) onSelect(activeButton);
  }, [activeButton, onSelect]);

  const isHighlighted = useCallback(
    (button: BoardButton) =>
      enabled &&
      activeCell !== undefined &&
      button.position.row === activeCell.row &&
      button.position.column === activeCell.column,
    [enabled, activeCell],
  );

  return { isHighlighted, advance, select, activeLabel: activeButton ? buttonLabel(activeButton) : '' };
}
