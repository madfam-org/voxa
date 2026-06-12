/** Minimum AAC touch target: 1 cm at 96 dpi ≈ 38 CSS px */
export const MIN_TARGET_PX = 38;

export const CVI_THEMES = {
  default: {
    background: 'var(--voxa-bg, #f8fafc)',
    foreground: 'var(--voxa-fg, #0f172a)',
    buttonBorder: '#cbd5e1',
  },
  'cvi-dark': {
    background: '#0a0a0a',
    foreground: '#f5f5f5',
    buttonBorder: '#525252',
  },
  'cvi-high-contrast': {
    background: '#000000',
    foreground: '#ffffff',
    buttonBorder: '#ffffff',
  },
  /** Light grid inspired by classic AAC apps (e.g. Proloquo2Go-style layouts). */
  'classic-light': {
    background: '#e5e7eb',
    foreground: '#111827',
    buttonBorder: '#9ca3af',
  },
} as const;

export type CviTheme = keyof typeof CVI_THEMES;

export function targetSizePx(scale = 1): number {
  return Math.round(MIN_TARGET_PX * Math.max(scale, 1));
}

import type { CSSProperties } from 'react';

export function themeStyles(theme: CviTheme): CSSProperties {
  const t = CVI_THEMES[theme];
  return {
    backgroundColor: t.background,
    color: t.foreground,
  };
}

export { AacButton, type AacButtonProps } from './aac-button.js';
export { BoardGrid, type BoardGridProps } from './board-grid.js';
