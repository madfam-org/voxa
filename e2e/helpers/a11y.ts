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
