'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardButton } from '@voxa/core';
import { buildGridScanPath, clampSwitchInterval, type ScanOrder } from '@voxa/access';
import { announceScanLabel } from '@/lib/play-button-speech';

interface UseSwitchScanOptions {
  enabled: boolean;
  paused?: boolean;
  rows: number;
  columns: number;
  buttons: BoardButton[];
  intervalMs: number;
  order: ScanOrder;
  auditoryHighlight: boolean;
  auditoryVoice?: boolean;
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
  auditoryHighlight,
  auditoryVoice = false,
  onSelect,
  getLabel,
}: UseSwitchScanOptions) {
  const scanPath = useMemo(() => buildGridScanPath(rows, columns, order), [rows, columns, order]);
  const [step, setStep] = useState(0);
  const liveRef = useRef<HTMLDivElement>(null);

  const activeCell = scanPath[step % scanPath.length];
  const activeButton = activeCell ? findButtonAt(buttons, activeCell.row, activeCell.column) : undefined;

  const advance = useCallback(() => {
    setStep((s) => s + 1);
  }, []);

  const select = useCallback(() => {
    if (activeButton) onSelect(activeButton);
  }, [activeButton, onSelect]);

  useEffect(() => {
    if (!enabled || paused) return;

    const id = window.setInterval(
      () => setStep((s) => s + 1),
      clampSwitchInterval(intervalMs),
    );
    return () => window.clearInterval(id);
  }, [enabled, paused, intervalMs]);

  useEffect(() => {
    if (!enabled || !auditoryHighlight || !activeButton || !liveRef.current) return;
    liveRef.current.textContent = getLabel(activeButton);
  }, [enabled, auditoryHighlight, activeButton, step, getLabel]);

  useEffect(() => {
    if (!enabled || !auditoryVoice || !activeButton) return;
    announceScanLabel(getLabel(activeButton), activeButton.locale);
  }, [enabled, auditoryVoice, activeButton, step, getLabel]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        select();
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        advance();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, select, advance]);

  const isHighlighted = useCallback(
    (button: BoardButton) =>
      enabled &&
      activeCell !== undefined &&
      button.position.row === activeCell.row &&
      button.position.column === activeCell.column,
    [enabled, activeCell],
  );

  return { isHighlighted, advance, select, liveRef };
}
