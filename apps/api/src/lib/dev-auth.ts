import type { TeamRole } from '@voxa/core';

/** Header names of the local-development identity shortcut. */
export const DEV_AUTH_HEADERS = ['X-Voxa-User-Id', 'X-Voxa-Role'] as const;

const VALID_ROLES: TeamRole[] = ['communicator', 'editor', 'admin'];

function authRequiredFlag(): boolean {
  return (
    process.env.VOXA_JANUA_AUTH_REQUIRED === 'true' || process.env.JANUA_AUTH_REQUIRED === 'true'
  );
}

/**
 * Whether a caller may pick its identity with `X-Voxa-User-Id` / `X-Voxa-Role`
 * instead of a Janua access token (HTTP only; the WebSocket accepts only tickets).
 *
 * Fails closed: only when `NODE_ENV` is not `production` AND `VOXA_DEV_AUTH` is
 * exactly `true` AND auth is not explicitly required. Anything else means
 * every request needs a valid bearer token.
 */
export function devAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.VOXA_DEV_AUTH === 'true' &&
    !authRequiredFlag()
  );
}

export function parseDevRole(raw: string | undefined): TeamRole {
  const role = raw ?? 'editor';
  return VALID_ROLES.includes(role as TeamRole) ? (role as TeamRole) : 'communicator';
}
