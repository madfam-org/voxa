export class VoxaSyncError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'VoxaSyncError';
    this.status = status;
  }
}

export function isVersionConflictError(err: unknown): boolean {
  return err instanceof VoxaSyncError && err.status === 409;
}
