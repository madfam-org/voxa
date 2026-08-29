/** ARASAAC physical-trait values (legacy API labels — UI uses inclusive labels). */
export type ArasaacSkinTone = 'white' | 'black' | 'asian' | 'mulatto' | 'aztec';

export type ArasaacHairColor =
  | 'blonde'
  | 'brown'
  | 'darkBrown'
  | 'gray'
  | 'darkGray'
  | 'red'
  | 'black';

export interface ArasaacSymbolRef {
  provider: 'arasaac';
  pictogramId: number;
  skinTone?: ArasaacSkinTone;
  hairColor?: ArasaacHairColor;
}

/**
 * Reference to a locally vendored Mulberry Symbol (CC BY-SA 4.0, © Steve Lee /
 * mulberrysymbols.org). Unlike ARASAAC (CC BY-NC-SA, non-commercial only),
 * Mulberry permits commercial use, so it is the commercially-clean default
 * source for Voxa's imagery. `slug` is a concept slug that maps to a vendored
 * SVG (see `@voxa/symbols` `mulberryImageUrl`).
 */
export interface MulberrySymbolRef {
  provider: 'mulberry';
  slug: string;
}

export type SymbolRef = ArasaacSymbolRef | MulberrySymbolRef;

export interface SymbolDisplayDefaults {
  skinTone?: ArasaacSkinTone;
  hairColor?: ArasaacHairColor;
}
