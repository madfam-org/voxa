import type { Context, MiddlewareHandler } from 'hono';
import { devAuthEnabled, parseDevRole } from './dev-auth.js';
import { consumeWsTicket, sourceTokenExpiry, type WsTicketGrant } from './ws-tickets.js';

declare module 'hono' {
  interface ContextVariableMap {
    wsGrant: WsTicketGrant;
  }
}

/**
 * Resolves the WebSocket caller from a single-use ticket (`?ticket=`, minted by
 * `POST /v1/ws-ticket`; see `ws-tickets.ts`). Access tokens are never read from
 * the URL. Without a valid ticket it returns null, unless the local-development
 * shortcut (`?userId=&role=`) is enabled; see `devAuthEnabled()`, never in
 * production.
 */
export async function resolveWsTeam(c: Context): Promise<WsTicketGrant | null> {
  const ticket = c.req.query('ticket');
  if (ticket) {
    return consumeWsTicket(ticket, { databaseUrl: process.env.DATABASE_URL });
  }

  if (!devAuthEnabled()) return null;

  const now = Date.now();
  return {
    userId: c.req.query('userId') ?? 'dev-user',
    role: parseDevRole(c.req.query('role')),
    tokenExpiresAt: sourceTokenExpiry({ userId: 'dev-user', role: 'communicator' }, now),
  };
}

/**
 * Runs before the upgrade: a missing, reused or expired ticket answers 401 and
 * the socket never opens. The grant is left on the context for the handler.
 */
export function wsTicketGate(): MiddlewareHandler {
  return async (c, next) => {
    const grant = await resolveWsTeam(c);
    if (!grant) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('wsGrant', grant);
    await next();
  };
}
