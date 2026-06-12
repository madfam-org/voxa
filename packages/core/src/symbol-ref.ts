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

export type SymbolRef = ArasaacSymbolRef;

export interface SymbolDisplayDefaults {
  skinTone?: ArasaacSkinTone;
  hairColor?: ArasaacHairColor;
}
