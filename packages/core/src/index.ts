/** Unique identifiers */
export type BoardId = string & { readonly __brand: 'BoardId' };
export type ButtonId = string & { readonly __brand: 'ButtonId' };
export type ProfileId = string & { readonly __brand: 'ProfileId' };

export type LocaleCode = string;

/** Modified Fitzgerald Key part-of-speech tag for button styling */
export type PartOfSpeechTag =
  | 'adjective'
  | 'verb'
  | 'pronoun'
  | 'noun'
  | 'preposition'
  | 'conjunction';

/** Team roles for collaborative board editing */
export type TeamRole = 'communicator' | 'editor' | 'admin';

export interface TeamMember {
  userId: string;
  role: TeamRole;
  displayName?: string;
}

export interface BoardAccess {
  boardId: BoardId;
  members: TeamMember[];
}

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

/** Alternate spoken forms (tenses, plurals, etc.) for analytic buttons */
export interface SpeechForm {
  id: string;
  label: string;
  speechText: string;
}

/** Analytic single-word or short-phrase button */
export interface AnalyticButton {
  kind: 'analytic';
  id: ButtonId;
  label: string;
  symbolUrl?: string;
  speechText: string;
  audio?: RecordedSpeech;
  /** Alternate inflected forms; active form selected via activeSpeechFormId or tap-cycle */
  speechForms?: SpeechForm[];
  activeSpeechFormId?: string;
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
  partOfSpeech?: PartOfSpeechTag;
  /** Hidden from communicator view until revealed by editor (OpenAAC hide/show). */
  hidden?: boolean;
  /** OBF `load_board_id` — navigate to another board on activation. */
  navigateToBoardId?: BoardId;
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
  ownerUserId?: string;
  orgId?: string;
}

export interface Utterance {
  buttonIds: ButtonId[];
  composedText: string;
  spokenAt: string;
}

/** Real-time sync envelope broadcast to connected clients */
export type SyncEventType = 'board.updated' | 'board.created' | 'presence.join' | 'presence.leave';

export interface SyncEvent {
  id: string;
  type: SyncEventType;
  boardId: BoardId;
  version: number;
  actorUserId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface BoardUpdateResult {
  board: Board;
  event: SyncEvent;
}

export interface MotorPlanningConflict {
  code: 'MOTOR_PLANNING_VIOLATION';
  message: string;
  violations: Array<{ buttonId: string; previous: GridPosition; next: GridPosition }>;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
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

export function buttonRecordedSpeech(btn: BoardButton): RecordedSpeech | undefined {
  if (btn.kind === 'glp') return btn.audio;
  return btn.audio;
}

export function buttonMediaVideo(btn: BoardButton): MediaAsset | undefined {
  return btn.kind === 'glp' ? btn.video : undefined;
}

export function resolveButtonSpeech(btn: BoardButton, formIndex?: number): string {
  if (btn.kind === 'glp') return btn.phrase;

  const forms = btn.speechForms;
  if (forms?.length) {
    if (formIndex !== undefined && forms[formIndex]) {
      return forms[formIndex].speechText;
    }
    if (btn.activeSpeechFormId) {
      const active = forms.find((form) => form.id === btn.activeSpeechFormId);
      if (active) return active.speechText;
    }
  }

  return btn.speechText;
}

export { createDemoBoard, DEMO_BOARD_ID } from './demo-board.js';
