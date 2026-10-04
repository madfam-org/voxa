import type { Context, Next } from 'hono';
import type { TeamRole } from '@voxa/core';
import { devAuthEnabled, parseDevRole } from '../lib/dev-auth.js';
import { mapJanuaRole, verifyAccessToken } from '../lib/janua.js';

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

function devTeamFromHeaders(c: Context): TeamContext {
  return {
    userId: c.req.header('X-Voxa-User-Id') ?? 'dev-user',
    role: parseDevRole(c.req.header('X-Voxa-Role')),
  };
}

/**
 * Resolves the caller from a Janua bearer token. Without one the request is
 * rejected with 401, unless the local-development header shortcut is enabled
 * (see `devAuthEnabled()`: never in production).
 */
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

    if (!devAuthEnabled()) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    c.set('team', devTeamFromHeaders(c));
    await next();
  };
}
