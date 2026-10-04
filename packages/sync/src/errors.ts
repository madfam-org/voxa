export class VoxaSyncError extends Error {
  readonly status: number;
  /** The API's JSON error body (e.g. `{ error, code, tier, limit }` on a 402). */
  readonly body: Record<string, unknown>;

  constructor(message: string, status: number, body: Record<string, unknown> = {}) {
    super(message);
    this.name = 'VoxaSyncError';
    this.status = status;
    this.body = body;
  }
}

export function isVersionConflictError(err: unknown): boolean {
  return err instanceof VoxaSyncError && err.status === 409;
}
