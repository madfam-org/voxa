/**
 * WCAG 2.2 AA contrast of every board theme: text 4.5:1 (1.4.3), non-text
 * 3:1 (1.4.11). The e2e axe scan of /app in each theme
 * (e2e/specs/a11y.spec.ts) checks the rendered page; this checks the tokens.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contrastRatio, CVI_THEMES, SCAN_RING, type CviTheme } from '@voxa/ui';

const THEMES = Object.keys(CVI_THEMES) as CviTheme[];

describe('board theme contrast', () => {
  it('covers all four themes', () => {
    assert.deepEqual(THEMES.sort(), ['classic-light', 'cvi-dark', 'cvi-high-contrast', 'default']);
  });

  for (const name of THEMES) {
    const theme = CVI_THEMES[name];
    const { chrome } = theme;

    it(`${name}: text on the theme background reaches 4.5:1`, () => {
      for (const [label, fg] of [
        ['foreground', theme.foreground],
        ['sync status (live)', chrome.statusLive],
        ['footer link', chrome.link],
        ['footer muted text', chrome.muted],
      ] as const) {
        const ratio = contrastRatio(fg, theme.background);
        assert.ok(ratio >= 4.5, `${name} ${label} ${fg} on ${theme.background} = ${ratio.toFixed(2)}:1`);
      }
    });

    it(`${name}: the message bar text reaches 4.5:1 and the bar edge 3:1`, () => {
      const text = contrastRatio(chrome.messageBarForeground, chrome.messageBarBackground);
      assert.ok(text >= 4.5, `${name} message bar text = ${text.toFixed(2)}:1`);
      const edge = Math.max(
        contrastRatio(chrome.messageBarBorder, theme.background),
        contrastRatio(chrome.messageBarBackground, theme.background),
      );
      assert.ok(edge >= 3, `${name} message bar boundary = ${edge.toFixed(2)}:1`);
    });

    it(`${name}: the scan highlight reaches 3:1 against the background and any button`, () => {
      // Grounds the ring can sit on: the board, the theme's button border,
      // white symbol-forward faces, Fitzgerald key fills and a mid gray.
      const grounds = [
        theme.background,
        theme.buttonBorder,
        '#ffffff',
        '#000000',
        '#facc15',
        '#fde68a',
        '#bfdbfe',
        '#bbf7d0',
        '#fecaca',
        '#767676',
        '#0a0a0a',
      ];
      for (const ground of grounds) {
        const best = Math.max(contrastRatio(SCAN_RING.dark, ground), contrastRatio(SCAN_RING.light, ground));
        assert.ok(best >= 3, `${name}: scan ring on ${ground} = ${best.toFixed(2)}:1`);
      }
      assert.ok(contrastRatio(SCAN_RING.dark, SCAN_RING.light) >= 3);
    });
  }

  it('the old single amber ring failed on light themes (regression guard for the measurement)', () => {
    assert.ok(contrastRatio('#facc15', CVI_THEMES['classic-light'].background) < 3);
    assert.ok(contrastRatio('#facc15', CVI_THEMES.default.background) < 3);
  });
});
