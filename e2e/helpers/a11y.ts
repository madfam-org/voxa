import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** WCAG 2.2 AA tags used for Voxa critical-page scans. */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

export async function analyzePage(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
  return analyzeCurrentPage(page);
}

export async function analyzeCurrentPage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  return new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
}

export function formatViolations(violations: Awaited<ReturnType<typeof analyzePage>>['violations']) {
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.length,
    help: v.help,
  }));
}

/** Axe violations that fail a scan when only serious and critical issues gate (WCAG 2.2 AA tags). */
export function blockingViolations(violations: Awaited<ReturnType<typeof analyzePage>>['violations']) {
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

/**
 * WCAG contrast ratio between an element's text colour and the first opaque
 * background behind it (the element's own, else its nearest ancestor's).
 */
export async function textContrast(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((el) => {
    const parse = (value: string): [number, number, number, number] => {
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const parts = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
      return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const fg = parse(getComputedStyle(el).color);
    let node: Element | null = el;
    let bg: number[] = [255, 255, 255, 1];
    while (node) {
      const candidate = parse(getComputedStyle(node).backgroundColor);
      if (candidate[3] >= 1) {
        bg = candidate;
        break;
      }
      node = node.parentElement;
    }
    const a = lum(fg);
    const b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, null);
}
