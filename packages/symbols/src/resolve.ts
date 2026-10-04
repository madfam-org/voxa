import type { SymbolDisplayDefaults, SymbolRef } from '@voxa/core';
import { isRemovedSymbolRef, isRemovedSymbolUrl } from './legacy.js';
import { resolveMulberrySymbolUrl } from './mulberry.js';

/**
 * Resolve a {@link SymbolRef} to a display URL. Mulberry refs resolve to the
 * vendored SVG; refs to the removed library resolve to nothing (label-only).
 */
export function resolveSymbolRefUrl(
  ref: SymbolRef,
  _defaults?: SymbolDisplayDefaults,
): string | undefined {
  switch (ref.provider) {
    case 'mulberry':
      return resolveMulberrySymbolUrl(ref);
    case 'arasaac':
      return undefined;
    default: {
      const _exhaustive: never = ref;
      return _exhaustive;
    }
  }
}

/**
 * Display URL for a button: its symbol reference first, then the stored URL.
 * Never returns a URL of the removed library; such buttons render label-only.
 */
export function resolveButtonSymbolUrl(
  symbolUrl: string | undefined,
  symbolRef: SymbolRef | undefined,
  defaults?: SymbolDisplayDefaults,
): string | undefined {
  if (isRemovedSymbolRef(symbolRef)) return undefined;
  const fromRef = symbolRef ? resolveSymbolRefUrl(symbolRef, defaults) : undefined;
  if (fromRef) return fromRef;
  return isRemovedSymbolUrl(symbolUrl) ? undefined : symbolUrl;
}

/**
 * True when a button had a symbol that Voxa no longer shows (a removed-library
 * reference or URL). The editor uses it to ask for a replacement.
 */
export function isSymbolUnavailable(
  symbolUrl: string | undefined,
  symbolRef: SymbolRef | undefined,
): boolean {
  return isRemovedSymbolRef(symbolRef) || isRemovedSymbolUrl(symbolUrl);
}
