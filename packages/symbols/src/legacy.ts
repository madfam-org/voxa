/**
 * Legacy-render shim for symbols from a library Voxa no longer serves.
 *
 * Boards stored before the switch to Mulberry may carry
 * `symbolRef: { provider: 'arasaac', … }` or an image URL on that library's
 * CDN. That library is licensed for non-commercial use only, so Voxa must not
 * render, proxy or export those images. This module only *recognises* them so
 * the cell renders label-only and the editor can ask for a replacement.
 *
 * This is the only source file (with tests) allowed to name the removed
 * library's hosts; see `no-removed-symbol-hosts.test.ts`.
 */
import type { SymbolRef } from '@voxa/core';

const REMOVED_SYMBOL_HOSTS = ['arasaac.org'];

/** True when `url` points at a host of the removed symbol library. */
export function isRemovedSymbolUrl(url: string | undefined): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return REMOVED_SYMBOL_HOSTS.some((removed) => host === removed || host.endsWith(`.${removed}`));
}

/** True when the reference names the removed library. */
export function isRemovedSymbolRef(ref: SymbolRef | undefined): boolean {
  return (ref as { provider?: string } | undefined)?.provider === 'arasaac';
}
