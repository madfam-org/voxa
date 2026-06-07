/** Unique identifiers */
export type BoardId = string & { readonly __brand: 'BoardId' };
export type ButtonId = string & { readonly __brand: 'ButtonId' };
export type ProfileId = string & { readonly __brand: 'ProfileId' };

export type LocaleCode = string;

/** Grid position — immutable for motor-planning core slots */
export interface GridPosition {
  row: number;
  column: number;
}

export interface MediaAsset {
  url: string;
  mimeType: string;
  thumbnailUrl?: string;
}

export interface RecordedSpeech {
  url: string;
  recordedBy: string;
  durationMs?: number;
}

/** Analytic single-word or short-phrase button */
export interface AnalyticButton {
  kind: 'analytic';
  id: ButtonId;
  label: string;
  symbolUrl?: string;
  speechText: string;
  locale: LocaleCode;
}

/** Gestalt Language Processing phrase chunk */
export interface GlpButton {
  kind: 'glp';
  id: ButtonId;
  phrase: string;
  symbolUrl?: string;
  audio?: RecordedSpeech;
  video?: MediaAsset;
  intonationNotes?: string;
  locale: LocaleCode;
}

export type BoardButton = (AnalyticButton | GlpButton) & {
  position: GridPosition;
  locked: boolean;
};

export interface BoardGrid {
  rows: number;
  columns: number;
  buttons: BoardButton[];
}

export interface CommunicatorProfile {
  id: ProfileId;
  displayName: string;
  primaryLocale: LocaleCode;
  secondaryLocale?: LocaleCode;
  accessMode: 'touch' | 'switch' | 'eye-tracking';
  theme: 'default' | 'cvi-dark' | 'cvi-high-contrast';
  targetScale: number;
}

export interface Board {
  id: BoardId;
  name: string;
  profileId: ProfileId;
  grid: BoardGrid;
  version: number;
  updatedAt: string;
}

export interface Utterance {
  buttonIds: ButtonId[];
  composedText: string;
  spokenAt: string;
}

export function createBoardId(id: string): BoardId {
  return id as BoardId;
}

export function createButtonId(id: string): ButtonId {
  return id as ButtonId;
}

export function createProfileId(id: string): ProfileId {
  return id as ProfileId;
}
