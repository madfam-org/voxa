import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { closeSharedDb, getSharedDb } from '../db/client.js';
import { consumeWsTicket, mintWsTicket, WS_TICKET_TTL_MS } from '../lib/ws-tickets.js';
import { initStore } from '../store/index.js';

/**
 * WebSocket tickets in PostgreSQL (two API replicas share them). Runs when
 * VOXA_TEST_DATABASE_URL is set (a throwaway database: it migrates and writes
 * there) and skips itself otherwise.
 */
const testDatabaseUrl = process.env.VOXA_TEST_DATABASE_URL?.trim();
const skip = testDatabaseUrl ? false : 'VOXA_TEST_DATABASE_URL is not set';

describe('WebSocket tickets on PostgreSQL', { skip }, () => {
  before(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    assert.equal(await initStore(), 'postgres');
  });

  after(async () => {
    await closeSharedDb();
  });

  const team = { userId: 'pg-ticket-user', role: 'editor' as const, orgId: 'org-pg' };

  it('stores only the hash and consumes a ticket exactly once, even when raced', async () => {
    const tokenExp = Math.floor(Date.now() / 1000) + 600;
    const minted = await mintWsTicket({ ...team, tokenExp }, { databaseUrl: testDatabaseUrl });
    assert.ok(minted);

    const { client } = getSharedDb(testDatabaseUrl!);
    const stored = await client`select ticket_hash, user_id, token_expires_at from ws_tickets where user_id = ${team.userId}`;
    assert.equal(stored.length, 1);
    assert.notEqual(stored[0]!.ticket_hash, minted.ticket);
    assert.match(String(stored[0]!.ticket_hash), /^[0-9a-f]{64}$/);

    const results = await Promise.all([
      consumeWsTicket(minted.ticket, { databaseUrl: testDatabaseUrl }),
      consumeWsTicket(minted.ticket, { databaseUrl: testDatabaseUrl }),
    ]);
    const granted = results.filter(Boolean);
    assert.equal(granted.length, 1);
    assert.equal(granted[0]!.userId, team.userId);
    assert.equal(granted[0]!.orgId, 'org-pg');
    assert.equal(granted[0]!.tokenExpiresAt, tokenExp * 1000);
    assert.equal(await consumeWsTicket(minted.ticket, { databaseUrl: testDatabaseUrl }), null);
  });

  it('refuses an expired ticket', async () => {
    const tokenExp = Math.floor(Date.now() / 1000) + 600;
    const minted = await mintWsTicket(
      { ...team, tokenExp },
      { databaseUrl: testDatabaseUrl, now: Date.now() - WS_TICKET_TTL_MS - 1000 },
    );
    assert.ok(minted);
    assert.equal(await consumeWsTicket(minted.ticket, { databaseUrl: testDatabaseUrl }), null);
  });
});
