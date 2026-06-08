import { randomUUID } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import { createDb } from '../db/client.js';
import { activationEvents, boards } from '../db/schema.js';
import { getStoreDriver } from '../store/index.js';

export interface ActivationInput {
  boardId: string;
  buttonId: string;
  speechText?: string;
  recordedAt?: string;
}

export interface ActivationSummary {
  boardId: string;
  days: number;
  totalActivations: number;
  byButton: Array<{ buttonId: string; count: number }>;
}

const fileActivations: ActivationInput[] = [];

export async function recordActivation(
  databaseUrl: string | undefined,
  userId: string,
  input: ActivationInput,
): Promise<void> {
  const recordedAt = input.recordedAt ?? new Date().toISOString();

  if (!databaseUrl || getStoreDriver() !== 'postgres') {
    fileActivations.push({ ...input, recordedAt });
    return;
  }

  const { db } = createDb(databaseUrl);
  await db.insert(activationEvents).values({
    id: randomUUID(),
    boardId: input.boardId,
    buttonId: input.buttonId,
    userId,
    speechText: input.speechText ?? null,
    recordedAt,
  });
}

export async function getActivationSummary(
  databaseUrl: string | undefined,
  boardId: string,
  days: number,
): Promise<ActivationSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  if (!databaseUrl || getStoreDriver() !== 'postgres') {
    const recent = fileActivations.filter(
      (event) => event.boardId === boardId && (event.recordedAt ?? '') >= since,
    );
    const counts = new Map<string, number>();
    for (const event of recent) {
      counts.set(event.buttonId, (counts.get(event.buttonId) ?? 0) + 1);
    }
    return {
      boardId,
      days,
      totalActivations: recent.length,
      byButton: [...counts.entries()].map(([buttonId, count]) => ({ buttonId, count })),
    };
  }

  const { db } = createDb(databaseUrl);
  const rows = await db
    .select({
      buttonId: activationEvents.buttonId,
      count: sql<number>`count(*)::int`,
    })
    .from(activationEvents)
    .where(and(eq(activationEvents.boardId, boardId), gte(activationEvents.recordedAt, since)))
    .groupBy(activationEvents.buttonId);

  const totalActivations = rows.reduce((sum, row) => sum + row.count, 0);
  return {
    boardId,
    days,
    totalActivations,
    byButton: rows.map((row) => ({ buttonId: row.buttonId, count: row.count })),
  };
}

export async function boardExists(databaseUrl: string | undefined, boardId: string): Promise<boolean> {
  if (!databaseUrl || getStoreDriver() !== 'postgres') {
    return true;
  }
  const { db } = createDb(databaseUrl);
  const row = await db.select({ id: boards.id }).from(boards).where(eq(boards.id, boardId)).limit(1);
  return row.length > 0;
}

/** Test helper */
export function resetFileActivationsForTests(): void {
  fileActivations.length = 0;
}
