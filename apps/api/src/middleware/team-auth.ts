import type { Context, Next } from 'hono';
import type { TeamRole } from '@voxa/core';
import { isJanuaConfigured, mapJanuaRole, verifyAccessToken } from '../lib/janua.js';

export interface TeamContext {
  userId: string;
  role: TeamRole;
  orgId?: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    team: TeamContext;
  }
}

const VALID_ROLES: TeamRole[] = ['communicator', 'editor', 'admin'];
const AUTH_REQUIRED = process.env.JANUA_AUTH_REQUIRED === 'true';

function devTeamFromHeaders(c: Context): TeamContext {
  const userId = c.req.header('X-Voxa-User-Id') ?? 'dev-user';
  const roleHeader = c.req.header('X-Voxa-Role') ?? 'editor';
  const role = VALID_ROLES.includes(roleHeader as TeamRole)
    ? (roleHeader as TeamRole)
    : 'communicator';
  return { userId, role };
}

export function teamAuth() {
  return async (c: Context, next: Next) => {
    const authorization = c.req.header('Authorization');
    if (authorization?.startsWith('Bearer ')) {
      try {
        const claims = await verifyAccessToken(authorization.slice('Bearer '.length));
        c.set('team', {
          userId: String(claims.sub),
          role: mapJanuaRole(claims),
          orgId: String(claims.org_id ?? claims.organization_id ?? '') || undefined,
        });
        await next();
        return;
      } catch {
        return c.json({ error: 'Invalid access token' }, 401);
      }
    }

    if (AUTH_REQUIRED || isJanuaConfigured()) {
      if (AUTH_REQUIRED) {
        return c.json({ error: 'Authentication required' }, 401);
      }
    }

    c.set('team', devTeamFromHeaders(c));
    await next();
  };
}

export function requireEditor(c: Context): boolean {
  const { role } = c.get('team');
  return role === 'editor' || role === 'admin';
}
