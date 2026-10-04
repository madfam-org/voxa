/** Minimum AAC touch target: 1 cm at 96 dpi ≈ 38 CSS px */
export const MIN_TARGET_PX = 38;

/**
 * Board themes. Every colour pair here is checked in
 * apps/web/src/lib/theme-contrast.test.ts against WCAG 2.2 AA (4.5:1 text,
 * 3:1 non-text): `chrome` holds the colours of the app chrome drawn on the
 * theme's own background (message bar, sync status, footer text and links).
 */
export const CVI_THEMES = {
  default: {
    background: '#f8fafc',
    foreground: '#0f172a',
    buttonBorder: '#cbd5e1',
    chrome: {
      messageBarBackground: '#ffffff',
      messageBarForeground: '#0f172a',
      messageBarBorder: '#475569',
      statusLive: '#166534',
      link: '#1d4ed8',
      muted: '#475569',
    },
  },
  'cvi-dark': {
    background: '#0a0a0a',
    foreground: '#f5f5f5',
    buttonBorder: '#525252',
    chrome: {
      messageBarBackground: '#171717',
      messageBarForeground: '#f5f5f5',
      messageBarBorder: '#737373',
      statusLive: '#4ade80',
      link: '#93c5fd',
      muted: '#a3a3a3',
    },
  },
  'cvi-high-contrast': {
    background: '#000000',
    foreground: '#ffffff',
    buttonBorder: '#ffffff',
    chrome: {
      messageBarBackground: '#000000',
      messageBarForeground: '#ffffff',
      messageBarBorder: '#ffffff',
      statusLive: '#4ade80',
      link: '#93c5fd',
      muted: '#d4d4d4',
    },
  },
  /** Light grid inspired by classic AAC apps (e.g. Proloquo2Go-style layouts). */
  'classic-light': {
    background: '#e5e7eb',
    foreground: '#111827',
    buttonBorder: '#9ca3af',
    chrome: {
      messageBarBackground: '#ffffff',
      messageBarForeground: '#111827',
      messageBarBorder: '#4b5563',
      statusLive: '#166534',
      link: '#1e40af',
      muted: '#374151',
    },
  },
} as const;

/**
 * Scan highlight: a dark ring inside a light ring. Whatever the button fill
 * and the board background, one of the two rings contrasts at least 4.5:1
 * with it (and the rings 21:1 with each other), so the cursor stays visible
 * on every theme (WCAG 1.4.11, 3:1 non-text). The amber border is a colour
 * cue on top, not what carries the contrast.
 */
export const SCAN_RING = {
  dark: '#000000',
  light: '#ffffff',
  accent: '#facc15',
} as const;

/** WCAG relative luminance of a #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (offset: number) => {
    const c = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type CviTheme = keyof typeof CVI_THEMES;

export const CVI_THEME_LABELS: Record<CviTheme, string> = {
  default: 'Default',
  'cvi-dark': 'CVI dark',
  'cvi-high-contrast': 'CVI high contrast',
  'classic-light': 'Classic light (Proloquo-style)',
};

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
