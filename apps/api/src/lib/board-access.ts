import { DEMO_BOARD_ID, type TeamRole } from '@voxa/core';

export function canAccessBoard(
  boardId: string,
  ownerUserId: string | undefined,
  actorUserId: string,
  role: TeamRole,
): boolean {
  if (boardId === DEMO_BOARD_ID) return true;
  if (role === 'admin') return true;
  if (ownerUserId && ownerUserId === actorUserId) return true;
  return false;
}

export function canEditBoard(
  boardId: string,
  ownerUserId: string | undefined,
  actorUserId: string,
  role: TeamRole,
): boolean {
  if (role !== 'editor' && role !== 'admin') return false;
  if (boardId === DEMO_BOARD_ID) return true;
  if (role === 'admin') return true;
  return Boolean(ownerUserId && ownerUserId === actorUserId);
}
