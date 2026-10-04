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

/**
 * LEGACY. Reference to a pictogram of a non-commercial library that Voxa no
 * longer renders, searches or exports. Kept only so boards stored before the
 * switch still parse; `@voxa/symbols` resolves it to nothing (label-only) and
 * the editor asks for a replacement.
 */
export interface ArasaacSymbolRef {
  provider: 'arasaac';
  pictogramId: number;
  skinTone?: ArasaacSkinTone;
  hairColor?: ArasaacHairColor;
}

/**
 * Reference to a locally vendored Mulberry Symbol (CC BY-SA 4.0, © Steve Lee /
 * mulberrysymbols.org), Voxa's symbol library. `slug` is either a Core concept
 * slug (slug-named SVG) or a slug of the full-set index; `file` is the
 * upstream path inside the vendored set (`EN/<name>.svg`) and wins when set
 * (see `@voxa/symbols` `resolveMulberrySymbolUrl`).
 */
export interface MulberrySymbolRef {
  provider: 'mulberry';
  slug: string;
  file?: string;
}

export type SymbolRef = ArasaacSymbolRef | MulberrySymbolRef;

export interface SymbolDisplayDefaults {
  skinTone?: ArasaacSkinTone;
  hairColor?: ArasaacHairColor;
}
