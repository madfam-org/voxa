import type { TeamRole } from '@voxa/core';
import { ACCOUNT_OWNER_KEY, claimAccountData } from './account-data';

/**
 * The signed-in user as page code knows it: `GET /api/auth/session` (Auth.js),
 * which answers identity and Voxa role only, never a token. Loaded once per
 * page; before it resolves as signed in, this browser's stored account data is
 * claimed for that user (and purged if it belonged to someone else).
 */
export interface ClientSession {
  /**
   * `unknown` when the session could not be read (offline, server error):
   * never treated as "signed out", so queued offline saves are kept, not
   * dropped, until the session is known again.
   */
  status: 'signed-in' | 'signed-out' | 'unknown';
  signedIn: boolean;
  userId: string | null;
  name: string | null;
  email: string | null;
  teamRole: TeamRole;
}

const SIGNED_OUT: ClientSession = {
  status: 'signed-out',
  signedIn: false,
  userId: null,
  name: null,
  email: null,
  teamRole: 'communicator',
};

let pending: Promise<ClientSession> | null = null;

const UNKNOWN: ClientSession = { ...SIGNED_OUT, status: 'unknown' };

async function fetchClientSession(): Promise<ClientSession> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return UNKNOWN;
    const body = (await res.json()) as {
      user?: { id?: unknown; name?: unknown; email?: unknown };
      teamRole?: unknown;
    } | null;
    const userId = typeof body?.user?.id === 'string' && body.user.id ? body.user.id : null;
    if (!userId) return SIGNED_OUT;
    await claimAccountData(userId);
    const teamRole = body?.teamRole;
    return {
      status: 'signed-in',
      signedIn: true,
      userId,
      name: typeof body?.user?.name === 'string' ? body.user.name : null,
      email: typeof body?.user?.email === 'string' ? body.user.email : null,
      teamRole: teamRole === 'admin' || teamRole === 'editor' ? teamRole : 'communicator',
    };
  } catch {
    return UNKNOWN;
  }
}

/** Loaded once per page; an `unknown` answer is not kept, so the next call asks again. */
export function loadClientSession(): Promise<ClientSession> {
  if (!pending) {
    pending = fetchClientSession().then((session) => {
      if (session.status === 'unknown') pending = null;
      return session;
    });
  }
  return pending;
}

/** Asks the server again (for example when the connection comes back). */
export function reloadClientSession(): Promise<ClientSession> {
  pending = null;
  return loadClientSession();
}

/** The account this browser's data was last claimed for (`claimAccountData`), if any. */
export function lastKnownAccountOwner(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_OWNER_KEY);
  } catch {
    return null;
  }
}

export async function isSignedIn(): Promise<boolean> {
  return (await loadClientSession()).signedIn;
}
