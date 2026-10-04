import { DEMO_BOARD_ID, type TeamRole } from '@voxa/core';

/**
 * True when the board and the actor belong to the same, known organization.
 * Both ids must be present: a token without `org_id` never matches an org board,
 * and there is no cross-tenant role.
 */
function sameOrg(boardOrgId?: string, actorOrgId?: string): boolean {
  return Boolean(boardOrgId && actorOrgId && boardOrgId === actorOrgId);
}

/**
 * Read access. The shared demo board is readable by everyone. Any other board is
 * readable by its owner and by editors/admins of the board's own organization.
 */
export function canAccessBoard(
  boardId: string,
  ownerUserId: string | undefined,
  actorUserId: string,
  role: TeamRole,
  boardOrgId?: string,
  actorOrgId?: string,
): boolean {
  if (boardId === DEMO_BOARD_ID) return true;
  if (ownerUserId && ownerUserId === actorUserId) return true;
  if ((role === 'editor' || role === 'admin') && sameOrg(boardOrgId, actorOrgId)) return true;
  return false;
}

/**
 * Write access (update, import, delete, media upload, audit and usage reports).
 * The shared demo board is read-only for everyone. The owner may always edit
 * their own board, whatever their role; editors and admins may edit boards of
 * their own organization.
 */
export function canEditBoard(
  boardId: string,
  ownerUserId: string | undefined,
  actorUserId: string,
  role: TeamRole,
  boardOrgId?: string,
  actorOrgId?: string,
): boolean {
  if (boardId === DEMO_BOARD_ID) return false;
  if (ownerUserId && ownerUserId === actorUserId) return true;
  if ((role === 'editor' || role === 'admin') && sameOrg(boardOrgId, actorOrgId)) return true;
  return false;
}
