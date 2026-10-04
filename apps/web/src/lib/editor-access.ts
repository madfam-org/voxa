import { DEMO_BOARD_ID, type TeamRole } from '@voxa/core';

/**
 * Who may use editor mode on which board, mirroring the API's rules: the
 * shared demo board is read-only for everyone; the owner may edit their own
 * board whatever their role; editors/admins (Janua `voxa:*` app roles) may edit
 * boards of their organization, which the API checks per board.
 */
export interface EditorAccessInput {
  boardId: string;
  boardOwnerUserId?: string;
  isAuthenticated: boolean;
  sessionUserId?: string;
  sessionTeamRole: TeamRole;
}

/** Board shown when nothing was selected yet: the read-only demo board. */
export function initialBoardId(storedBoardId: string | null | undefined): string {
  return storedBoardId || DEMO_BOARD_ID;
}

export function ownsBoard(input: EditorAccessInput): boolean {
  return Boolean(
    input.isAuthenticated &&
      input.boardOwnerUserId &&
      input.sessionUserId &&
      input.boardOwnerUserId === input.sessionUserId,
  );
}

/** Signed in with a Voxa editor/admin app role (no device PIN needed). */
export function isTrustedEditorSession(input: EditorAccessInput): boolean {
  return (
    input.isAuthenticated && (input.sessionTeamRole === 'editor' || input.sessionTeamRole === 'admin')
  );
}

/** Editor mode can be switched on for this board at all (never on the demo board). */
export function editorModeAllowed(input: EditorAccessInput): boolean {
  return input.boardId !== DEMO_BOARD_ID;
}

/** The signed-in account may save edits to this board. */
export function accountMayEditBoard(input: EditorAccessInput): boolean {
  return editorModeAllowed(input) && (ownsBoard(input) || isTrustedEditorSession(input));
}

/**
 * Role the remote editor (`/app/edit`) runs with. Account editors get their
 * account role; an owner gets `editor` on their own board once the device's
 * editor PIN (if one is configured) is unlocked; everyone else communicates.
 */
export function remoteEditorRole(input: EditorAccessInput, pinUnlocked: boolean): TeamRole {
  if (!editorModeAllowed(input)) return 'communicator';
  if (isTrustedEditorSession(input)) return input.sessionTeamRole;
  if (ownsBoard(input) && pinUnlocked) return 'editor';
  return 'communicator';
}
