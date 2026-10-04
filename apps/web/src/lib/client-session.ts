import type { TeamRole } from '@voxa/core';
import { claimAccountData } from './account-data';

/**
 * The signed-in user as page code knows it: `GET /api/auth/session` (Auth.js),
 * which answers identity and Voxa role only, never a token. Loaded once per
 * page; before it resolves as signed in, this browser's stored account data is
 * claimed for that user (and purged if it belonged to someone else).
 */
export interface ClientSession {
  signedIn: boolean;
  userId: string | null;
  name: string | null;
  email: string | null;
  teamRole: TeamRole;
}

const SIGNED_OUT: ClientSession = {
  signedIn: false,
  userId: null,
  name: null,
  email: null,
  teamRole: 'communicator',
};

let pending: Promise<ClientSession> | null = null;

async function fetchClientSession(): Promise<ClientSession> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return SIGNED_OUT;
    const body = (await res.json()) as {
      user?: { id?: unknown; name?: unknown; email?: unknown };
      teamRole?: unknown;
    } | null;
    const userId = typeof body?.user?.id === 'string' && body.user.id ? body.user.id : null;
    if (!userId) return SIGNED_OUT;
    await claimAccountData(userId);
    const teamRole = body?.teamRole;
    return {
      signedIn: true,
      userId,
      name: typeof body?.user?.name === 'string' ? body.user.name : null,
      email: typeof body?.user?.email === 'string' ? body.user.email : null,
      teamRole: teamRole === 'admin' || teamRole === 'editor' ? teamRole : 'communicator',
    };
  } catch {
    return SIGNED_OUT;
  }
}

export function loadClientSession(): Promise<ClientSession> {
  if (!pending) pending = fetchClientSession();
  return pending;
}

export async function isSignedIn(): Promise<boolean> {
  return (await loadClientSession()).signedIn;
}
