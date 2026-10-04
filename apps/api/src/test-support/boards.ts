import type { Hono } from 'hono';

/** Development-header identity for route tests (needs VOXA_DEV_AUTH=true, set by the preload). */
export function devHeaders(userId: string, role: 'communicator' | 'editor' | 'admin' = 'communicator') {
  return { 'X-Voxa-User-Id': userId, 'X-Voxa-Role': role };
}

/** Creates a board owned by `userId` through `POST /v1/boards` and returns its id. */
export async function createOwnedBoard(
  app: Hono,
  userId: string,
  boardId: string,
  role: 'communicator' | 'editor' | 'admin' = 'communicator',
): Promise<string> {
  const res = await app.request('/v1/boards', {
    method: 'POST',
    headers: { ...devHeaders(userId, role), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: boardId,
      name: `Board ${boardId}`,
      profileId: 'default',
      version: 1,
      updatedAt: new Date().toISOString(),
      grid: { rows: 2, columns: 2, buttons: [] },
    }),
  });
  if (res.status !== 201) {
    throw new Error(`createOwnedBoard(${boardId}) answered ${res.status}: ${await res.text()}`);
  }
  return boardId;
}
