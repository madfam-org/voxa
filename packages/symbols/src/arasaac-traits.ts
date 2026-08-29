import type {
  ArasaacHairColor,
  ArasaacSkinTone,
  ArasaacSymbolRef,
  SymbolDisplayDefaults,
  SymbolRef,
} from '@voxa/core';
import { arasaacImageUrl } from './arasaac.js';
import { resolveMulberrySymbolUrl } from './mulberry.js';

export interface SkinToneOption {
  value: ArasaacSkinTone;
  label: string;
}

/** Inclusive UI labels mapped to ARASAAC trait identifiers. */
export const ARASAAC_SKIN_TONE_OPTIONS: SkinToneOption[] = [
  { value: 'white', label: 'Light' },
  { value: 'asian', label: 'East Asian' },
  { value: 'mulatto', label: 'Medium' },
  { value: 'aztec', label: 'Tan' },
  { value: 'black', label: 'Deep' },
];

const PERSON_TAGS = new Set([
  'person',
  'people',
  'human',
  'body',
  'face',
  'boy',
  'girl',
  'man',
  'woman',
  'child',
  'family',
]);

export function isPersonPictogram(tags: string[]): boolean {
  return tags.some((tag) => PERSON_TAGS.has(tag.toLowerCase()));
}

export function resolveArasaacSymbolUrl(
  ref: ArasaacSymbolRef,
  defaults?: SymbolDisplayDefaults,
): string {
  void (ref.skinTone ?? defaults?.skinTone);
  void (ref.hairColor ?? defaults?.hairColor);
  return arasaacImageUrl(ref.pictogramId);
}

/**
 * Resolve any {@link SymbolRef} to a display URL, dispatching on its provider.
 * ARASAAC refs resolve to the static pictogram CDN; Mulberry refs resolve to a
 * locally vendored SVG. Falls back to the legacy `symbolUrl` when unresolved.
 */
export function resolveSymbolRefUrl(
  ref: SymbolRef,
  defaults?: SymbolDisplayDefaults,
): string | undefined {
  switch (ref.provider) {
    case 'arasaac':
      return resolveArasaacSymbolUrl(ref, defaults);
    case 'mulberry':
      return resolveMulberrySymbolUrl(ref);
    default: {
      const _exhaustive: never = ref;
      return _exhaustive;
    }
  }
}

export function resolveButtonSymbolUrl(
  symbolUrl: string | undefined,
  symbolRef: SymbolRef | undefined,
  defaults?: SymbolDisplayDefaults,
): string | undefined {
  if (symbolRef) {
    return resolveSymbolRefUrl(symbolRef, defaults) ?? symbolUrl;
  }
  return symbolUrl;
}
