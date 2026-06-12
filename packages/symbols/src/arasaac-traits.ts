import type { ArasaacHairColor, ArasaacSkinTone, ArasaacSymbolRef, SymbolDisplayDefaults } from '@voxa/core';
import { arasaacImageUrl } from './arasaac.js';

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

export function resolveButtonSymbolUrl(
  symbolUrl: string | undefined,
  symbolRef: ArasaacSymbolRef | undefined,
  defaults?: SymbolDisplayDefaults,
): string | undefined {
  if (symbolRef) {
    return resolveArasaacSymbolUrl(symbolRef, defaults);
  }
  return symbolUrl;
}
