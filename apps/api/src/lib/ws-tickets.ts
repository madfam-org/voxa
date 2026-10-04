import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lte } from 'drizzle-orm';
import type { TeamRole } from '@voxa/core';
import { getSharedDb } from '../db/client.js';
import { wsTickets } from '../db/schema.js';
import { getStoreDriver } from '../store/index.js';
import type { TeamContext } from '../middleware/team-auth.js';

/**
 * Single-use WebSocket tickets.
 *
 * A browser cannot put an `Authorization` header on a WebSocket, and an access
 * token in the URL ends up in proxy and server logs. So the client first calls
 * `POST /v1/ws-ticket` with its bearer (the web app does it through its
 * same-origin proxy), gets a random ticket valid for WS_TICKET_TTL_MS, and
 * opens `GET /v1/ws?boardId=…&ticket=…`. The upgrade consumes the ticket
 * atomically: a second use, an unknown ticket or an expired one is refused
 * with 401 before the socket opens.
 *
 * Stored per ticket: its SHA-256 (never the ticket), who it was minted for
 * (user, Voxa role, organization, the three things board access needs), its
 * expiry, and the `exp` of the access token it came from. The socket is
 * closed at that `exp`, so a connection never outlives the token that opened
 * it. With a database the rows live in Postgres, shared by every API replica;
 * the file-store driver (local development, one process) keeps them in memory.
 */
export const WS_TICKET_TTL_MS = 30_000;

/** Used for the local-development identity headers, whose caller has no token `exp`. */
const DEV_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

const TICKET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface WsTicketGrant {
  userId: string;
  role: TeamRole;
  orgId?: string;
  /** The source access token's `exp`, in epoch milliseconds. */
  tokenExpiresAt: number;
}

export interface MintedWsTicket {
  ticket: string;
  expiresAt: string;
}

interface MemoryRow extends WsTicketGrant {
  expiresAt: number;
}

const memoryTickets = new Map<string, MemoryRow>();

function hashTicket(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}

function useDatabase(databaseUrl: string | undefined): databaseUrl is string {
  return Boolean(databaseUrl) && getStoreDriver() === 'postgres';
}

/** The epoch-millisecond `exp` a ticket minted for this caller carries. */
export function sourceTokenExpiry(team: TeamContext, now: number): number {
  return team.tokenExp !== undefined ? team.tokenExp * 1000 : now + DEV_TOKEN_LIFETIME_MS;
}

/**
 * Mints a ticket for the verified caller. Returns null when the source token
 * is already past its `exp` (the bearer check allows 30 s of clock skew).
 */
export async function mintWsTicket(
  team: TeamContext,
  options: { databaseUrl?: string; now?: number } = {},
): Promise<MintedWsTicket | null> {
  const now = options.now ?? Date.now();
  const tokenExpiresAt = sourceTokenExpiry(team, now);
  if (tokenExpiresAt <= now) return null;

  const ticket = randomBytes(32).toString('base64url');
  const ticketHash = hashTicket(ticket);
  const expiresAt = now + WS_TICKET_TTL_MS;

  if (!useDatabase(options.databaseUrl)) {
    for (const [hash, row] of memoryTickets) {
      if (row.expiresAt <= now) memoryTickets.delete(hash);
    }
    memoryTickets.set(ticketHash, {
      userId: team.userId,
      role: team.role,
      orgId: team.orgId,
      tokenExpiresAt,
      expiresAt,
    });
    return { ticket, expiresAt: new Date(expiresAt).toISOString() };
  }

  const { db } = getSharedDb(options.databaseUrl);
  // Housekeeping: tickets that were never used.
  await db.delete(wsTickets).where(lte(wsTickets.expiresAt, new Date(now).toISOString()));
  await db.insert(wsTickets).values({
    ticketHash,
    userId: team.userId,
    role: team.role,
    orgId: team.orgId ?? null,
    expiresAt: new Date(expiresAt).toISOString(),
    tokenExpiresAt: new Date(tokenExpiresAt).toISOString(),
  });
  return { ticket, expiresAt: new Date(expiresAt).toISOString() };
}

/**
 * Consumes a ticket exactly once. Returns null for a malformed, unknown,
 * already used or expired ticket. The delete is the read, so two replicas
 * racing on the same ticket cannot both succeed.
 */
export async function consumeWsTicket(
  ticket: string | undefined,
  options: { databaseUrl?: string; now?: number } = {},
): Promise<WsTicketGrant | null> {
  if (!ticket || !TICKET_PATTERN.test(ticket)) return null;
  const now = options.now ?? Date.now();
  const ticketHash = hashTicket(ticket);

  if (!useDatabase(options.databaseUrl)) {
    const row = memoryTickets.get(ticketHash);
    memoryTickets.delete(ticketHash);
    if (!row || row.expiresAt <= now || row.tokenExpiresAt <= now) return null;
    return {
      userId: row.userId,
      role: row.role,
      orgId: row.orgId,
      tokenExpiresAt: row.tokenExpiresAt,
    };
  }

  const { db } = getSharedDb(options.databaseUrl);
  const rows = await db
    .delete(wsTickets)
    .where(and(eq(wsTickets.ticketHash, ticketHash), gt(wsTickets.expiresAt, new Date(now).toISOString())))
    .returning();
  const row = rows[0];
  if (!row) return null;
  const tokenExpiresAt = Date.parse(row.tokenExpiresAt);
  if (!Number.isFinite(tokenExpiresAt) || tokenExpiresAt <= now) return null;
  return {
    userId: row.userId,
    role: row.role as TeamRole,
    orgId: row.orgId ?? undefined,
    tokenExpiresAt,
  };
}

/** Test helper: forget the in-memory tickets. */
export function resetMemoryWsTicketsForTests(): void {
  memoryTickets.clear();
}

/**
 * Closes the socket when the access token it was opened with expires. Returns
 * a function that cancels the timer (call it when the socket closes first).
 */
export function closeAtTokenExpiry(
  close: (code: number, reason: string) => void,
  tokenExpiresAt: number,
  options: {
    now?: number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (handle: unknown) => void;
  } = {},
): () => void {
  const now = options.now ?? Date.now();
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer =
    options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const handle = setTimer(() => close(4401, 'Token expired'), Math.max(0, tokenExpiresAt - now));
  return () => clearTimer(handle);
}
