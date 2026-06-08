'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VOXA_GAZE_EVENT, resolveGazeButtonId } from '@voxa/access';
import { useEyeDwell } from './use-eye-dwell';

interface UseGazeBridgeDwellOptions {
  enabled: boolean;
  dwellMs: number;
  onActivate: (buttonId: string) => void;
}

/** Coordinate-based dwell for Tobii / lab gaze injectors (`voxa:gaze` events). */
export function useGazeBridgeDwell({ enabled, dwellMs, onActivate }: UseGazeBridgeDwellOptions) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const { progress, start, cancel } = useEyeDwell(dwellMs, () => {
    if (activeIdRef.current) onActivate(activeIdRef.current);
  });

  const focusButton = useCallback(
    (buttonId: string | null) => {
      if (buttonId === activeIdRef.current) return;
      activeIdRef.current = buttonId;
      setActiveId(buttonId);
      if (buttonId) start();
      else cancel();
    },
    [cancel, start],
  );

  useEffect(() => {
    if (!enabled) {
      focusButton(null);
      return;
    }

    const onGaze = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; y: number }>).detail;
      if (!detail || typeof detail.x !== 'number' || typeof detail.y !== 'number') return;
      focusButton(resolveGazeButtonId(detail.x, detail.y));
    };

    window.addEventListener(VOXA_GAZE_EVENT, onGaze);
    return () => window.removeEventListener(VOXA_GAZE_EVENT, onGaze);
  }, [enabled, focusButton]);

  useEffect(() => {
    if (!enabled) return;
    (window as Window & { __voxaInjectGaze?: (x: number, y: number) => void }).__voxaInjectGaze = (
      x,
      y,
    ) => {
      window.dispatchEvent(new CustomEvent(VOXA_GAZE_EVENT, { detail: { x, y } }));
    };
    return () => {
      delete (window as Window & { __voxaInjectGaze?: (x: number, y: number) => void }).__voxaInjectGaze;
    };
  }, [enabled]);

  const dwellProgressFor = useCallback(
    (buttonId: string) => (enabled && activeId === buttonId ? progress : 0),
    [enabled, activeId, progress],
  );

  return { dwellProgressFor };
}
