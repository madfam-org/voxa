'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BoardButton } from '@voxa/core';
import { buildGridScanPath, clampSwitchInterval, type ScanOrder } from '@voxa/access';
import { buttonLabel } from '@/lib/board-utils';

interface UseMobileSwitchScanOptions {
  enabled: boolean;
  rows: number;
  columns: number;
  buttons: BoardButton[];
  intervalMs: number;
  order: ScanOrder;
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
