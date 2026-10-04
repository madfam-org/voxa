import type { Context } from 'hono';
import { devAuthEnabled, parseDevRole } from './dev-auth.js';
import { mapJanuaRole, verifyAccessToken } from './janua.js';
import type { TeamContext } from '../middleware/team-auth.js';

/**
 * Resolves the WebSocket caller from an access token (`?accessToken=` or a
 * bearer header). Without one it returns null (the socket is closed with 4401),
 * unless the local-development shortcut (`?userId=&role=`) is enabled; see
 * `devAuthEnabled()`.
 */
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

  if (!devAuthEnabled()) return null;

  return {
    userId: c.req.query('userId') ?? 'dev-user',
    role: parseDevRole(c.req.query('role')),
  };
}
