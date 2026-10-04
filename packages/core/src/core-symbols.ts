import type { Board, BoardButton } from './index.js';
import type { MulberrySymbolRef } from './symbol-ref.js';

/**
 * Checked-in allow-map for the pictograms shown on the Core 47 words of every
 * board Voxa produces (demo boards and starter templates).
 *
 * Source: Mulberry Symbols (© Steve Lee, https://mulberrysymbols.org,
 * CC BY-SA 4.0), vendored unmodified under
 * `apps/web/public/symbols/mulberry/<file>.svg` (see ATTRIBUTION.md there).
 * Every vendored file was re-checked by eye against the word's label in
 * es-MX, en-US and fr-FR. A word gets a picture only when the picture shows
 * the concept the label names in all three; otherwise the cell is label-only,
 * because a label-only cell is safer than a picture of the wrong concept.
 *
 * Status: AWAITS REVIEW BY A CREDENTIALED SPEECH-LANGUAGE PATHOLOGIST. No
 * reviewer has signed this map yet; until one does it is an engineering
 * cross-check, not a clinical sign-off.
 */
export type CoreSymbolEntry =
  | { provider: 'mulberry'; file: string }
  | { provider: 'label-only'; reason: string };

/** Public path under which the web app serves the vendored Mulberry SVGs. */
export const MULBERRY_SYMBOL_BASE = '/symbols/mulberry';

const NO_VENDORED_MATCH = 'no vendored Mulberry symbol for this concept';

export const CORE_SYMBOL_ALLOW_MAP: Readonly<Record<string, CoreSymbolEntry>> = {
  i: {
    provider: 'label-only',
    reason: 'Mulberry "I" is the Latin capital letter glyph; beside "yo"/"je" it reads as a letter, not the pronoun',
  },
  you: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  want: { provider: 'mulberry', file: 'want' },
  more: { provider: 'mulberry', file: 'more' },
  go: { provider: 'mulberry', file: 'go' },
  stop: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  help: { provider: 'mulberry', file: 'help' },
  eat: { provider: 'mulberry', file: 'eat' },
  drink: { provider: 'mulberry', file: 'drink' },
  yes: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  no: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  please: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  like: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  dont: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  different: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  again: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  'all-done': { provider: 'label-only', reason: NO_VENDORED_MATCH },
  wait: { provider: 'mulberry', file: 'wait' },
  look: { provider: 'mulberry', file: 'look' },
  listen: { provider: 'mulberry', file: 'listen' },
  come: { provider: 'mulberry', file: 'come' },
  turn: { provider: 'mulberry', file: 'turn' },
  put: { provider: 'mulberry', file: 'put' },
  get: { provider: 'mulberry', file: 'get' },
  make: { provider: 'mulberry', file: 'make' },
  do: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  see: { provider: 'mulberry', file: 'see' },
  feel: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  good: { provider: 'mulberry', file: 'good' },
  bad: { provider: 'mulberry', file: 'bad' },
  sorry: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  'thank-you': { provider: 'label-only', reason: NO_VENDORED_MATCH },
  me: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  my: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  it: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  that: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  this: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  here: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  there: { provider: 'label-only', reason: NO_VENDORED_MATCH },
  up: { provider: 'mulberry', file: 'up' },
  down: { provider: 'mulberry', file: 'down' },
  in: { provider: 'mulberry', file: 'in' },
  out: { provider: 'mulberry', file: 'out' },
  on: {
    provider: 'label-only',
    reason: 'Mulberry "on" is spatial (on top of); the es/fr labels "encendido"/"allumé" mean switched on',
  },
  off: {
    provider: 'label-only',
    reason: 'Mulberry "off" is spatial (moving off); the es/fr labels "apagado"/"éteint" mean switched off',
  },
  home: { provider: 'mulberry', file: 'home' },
  school: { provider: 'mulberry', file: 'school' },
};

export function mulberrySymbolUrl(file: string): string {
  return `${MULBERRY_SYMBOL_BASE}/${file}.svg`;
}

/** Symbol fields for a core word, or `undefined` when the word is label-only or not a core word. */
export function coreSymbolFields(
  slug: string,
): { symbolUrl: string; symbolRef: MulberrySymbolRef } | undefined {
  const entry = CORE_SYMBOL_ALLOW_MAP[slug];
  if (!entry || entry.provider !== 'mulberry') return undefined;
  return {
    symbolUrl: mulberrySymbolUrl(entry.file),
    symbolRef: { provider: 'mulberry', slug: entry.file },
  };
}

function withAllowedCoreSymbol(button: BoardButton): BoardButton {
  const slug = String(button.id);
  if (button.kind !== 'analytic' || !(slug in CORE_SYMBOL_ALLOW_MAP)) return button;
  const fields = coreSymbolFields(slug);
  const current = button.symbolRef?.provider === 'mulberry' ? button.symbolRef.slug : undefined;
  if (fields && current === fields.symbolRef.slug && button.symbolUrl === fields.symbolUrl) {
    return button;
  }
  if (!fields && !button.symbolUrl && !button.symbolRef) return button;
  const next = { ...button };
  delete next.symbolUrl;
  delete next.symbolRef;
  return fields ? { ...next, ...fields } : next;
}

/**
 * Put the allow-mapped symbol (or no symbol, for label-only words) on every
 * core-word button, replacing whatever symbol the button carried. Used for
 * boards Voxa itself produces and for the stored demo board at display time,
 * so a demo board persisted by an earlier release shows the current map.
 * Returns the same object when nothing changes.
 */
export function applyCoreSymbols(board: Board): Board {
  let changed = false;
  const buttons = board.grid.buttons.map((button) => {
    const next = withAllowedCoreSymbol(button);
    if (next !== button) changed = true;
    return next;
  });
  return changed ? { ...board, grid: { ...board.grid, buttons } } : board;
}
