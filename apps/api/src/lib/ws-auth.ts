import type { Context } from 'hono';
import type { TeamRole } from '@voxa/core';
import { isJanuaConfigured, mapJanuaRole, verifyAccessToken } from './janua.js';
import type { TeamContext } from '../middleware/team-auth.js';

const VALID_ROLES: TeamRole[] = ['communicator', 'editor', 'admin'];

function isAuthRequired(): boolean {
  return (
    process.env.VOXA_JANUA_AUTH_REQUIRED === 'true' ||
    process.env.JANUA_AUTH_REQUIRED === 'true'
  );
}

export async function resolveWsTeam(c: Context): Promise<TeamContext | null> {
  const queryToken = c.req.query('accessToken');
  const headerAuth = c.req.header('Authorization');
  const token =
    queryToken ?? (headerAuth?.startsWith('Bearer ') ? headerAuth.slice('Bearer '.length) : undefined);

  if (token) {
    try {
      const claims = await verifyAccessToken(token);
      return {
        userId: String(claims.sub),
        role: mapJanuaRole(claims),
        orgId: String(claims.org_id ?? claims.organization_id ?? '') || undefined,
      };
    } catch {
      return null;
    }
  }

  if (isAuthRequired() || isJanuaConfigured()) {
    if (isAuthRequired()) return null;
  }

  const userId = c.req.query('userId') ?? 'dev-user';
  const roleHeader = c.req.query('role') ?? 'editor';
  const role = VALID_ROLES.includes(roleHeader as TeamRole)
    ? (roleHeader as TeamRole)
    : 'communicator';
  return { userId, role };
}
