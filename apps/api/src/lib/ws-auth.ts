import type { Context, MiddlewareHandler } from 'hono';
import { consumeWsTicket, type WsTicketGrant } from './ws-tickets.js';

declare module 'hono' {
  interface ContextVariableMap {
    wsGrant: WsTicketGrant;
  }
}

/**
 * Resolves the WebSocket caller from a single-use ticket (`?ticket=`, minted by
 * `POST /v1/ws-ticket`; see `ws-tickets.ts`). That is the only way in: an
 * access token in the URL, an `Authorization` header and the development
 * identity shortcut are all ignored here. (Local development without Janua
 * still works: the ticket is minted through the development headers, which
 * `teamAuth` honours on `POST /v1/ws-ticket` when `devAuthEnabled()`.)
 */
export async function resolveWsTeam(c: Context): Promise<WsTicketGrant | null> {
  return consumeWsTicket(c.req.query('ticket'), { databaseUrl: process.env.DATABASE_URL });
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
