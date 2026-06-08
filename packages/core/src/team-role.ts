import type { TeamRole } from './index.js';

/** Map Janua / OIDC claims to Voxa team role (shared by API + web session). */
export function mapTeamRoleFromClaims(claims: Record<string, unknown>): TeamRole {
  const roles = claims.roles;
  if (Array.isArray(roles)) {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('editor') || roles.includes('slp')) return 'editor';
  }

  const role = String(claims.role ?? claims.voxa_role ?? '').toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'editor' || role === 'slp') return 'editor';
  return 'communicator';
}
