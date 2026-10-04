import type { TeamRole } from './index.js';

/** Prefix of the Janua application roles that authorize inside Voxa. */
export const VOXA_APP_ROLE_PREFIX = 'voxa:';

/**
 * Map Janua access-token claims to a Voxa team role (shared by API + web session).
 *
 * Only namespaced Janua application roles count: `voxa:admin` → admin,
 * `voxa:editor` or `voxa:slp` → editor. Everything else is a communicator.
 *
 * Janua organization roles (owner/admin/member/employee) describe authority over
 * the Janua account, not inside a product. They travel under `madfam_org_roles`
 * and, on the OIDC path, also as bare strings in `roles`. Bare `roles` entries,
 * `role` and `voxa_role` are therefore ignored on purpose: reading them would let
 * an organization admin of any tenant act as a Voxa admin.
 */
export function mapTeamRoleFromClaims(claims: Record<string, unknown>): TeamRole {
  const roles = Array.isArray(claims.roles)
    ? claims.roles.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.startsWith(VOXA_APP_ROLE_PREFIX),
      )
    : [];

  if (roles.includes('voxa:admin')) return 'admin';
  if (roles.includes('voxa:editor') || roles.includes('voxa:slp')) return 'editor';
  return 'communicator';
}
