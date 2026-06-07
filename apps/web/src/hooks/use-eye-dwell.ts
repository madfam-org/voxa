'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clampEyeDwell } from '@voxa/access';

export function useEyeDwell(dwellMs: number, onDwellComplete: () => void) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    timerRef.current = null;
    startRef.current = null;
    frameRef.current = null;
    setProgress(0);
  }, []);

  const start = useCallback(() => {
    cancel();
    const ms = clampEyeDwell(dwellMs);
    startRef.current = performance.now();

    const tick = () => {
      if (startRef.current === null) return;
      const elapsed = performance.now() - startRef.current;
      setProgress(Math.min(1, elapsed / ms));
      if (elapsed < ms) {
        frameRef.current = window.requestAnimationFrame(tick);
      }
    };

    frameRef.current = window.requestAnimationFrame(tick);
    timerRef.current = window.setTimeout(() => {
      setProgress(1);
      onDwellComplete();
      cancel();
    }, ms);
  }, [cancel, dwellMs, onDwellComplete]);

  useEffect(() => cancel, [cancel]);

  return { progress, start, cancel };
}

export function useEyeDwellByButton(
  enabled: boolean,
  dwellMs: number,
  onActivate: (buttonId: string) => void,
) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const { progress, start, cancel } = useEyeDwell(dwellMs, () => {
    if (activeIdRef.current) onActivate(activeIdRef.current);
  });

  const onEnter = useCallback(
    (buttonId: string) => {
      if (!enabled) return;
      activeIdRef.current = buttonId;
      setActiveId(buttonId);
      start();
    },
    [enabled, start],
  );

  const onLeave = useCallback(() => {
    activeIdRef.current = null;
    setActiveId(null);
    cancel();
  }, [cancel]);

  const dwellProgressFor = useCallback(
    (buttonId: string) => (enabled && activeId === buttonId ? progress : 0),
    [enabled, activeId, progress],
  );

  return { onEnter, onLeave, dwellProgressFor };
}
