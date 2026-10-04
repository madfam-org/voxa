import { VoxaSyncError } from '@voxa/sync';

/**
 * How a failed board save is handled.
 *
 * - `retry`: no answer (offline, network) or a transient server answer
 *   (401 until the session refreshes, 408, 429, 5xx). The save is queued and
 *   retried when the connection returns.
 * - `motor-plan`: 422 — the save moves a locked (motor-plan) button. Retrying
 *   the same body can never succeed, so it is dropped from the queue and the
 *   user is told why.
 * - `rejected`: any other refusal (400, 403, 404, 413 …). Also never retried.
 *
 * 409 (version conflict) is handled before this by the caller.
 */
export type SaveFailureKind = 'retry' | 'motor-plan' | 'rejected';

export function classifySaveFailure(err: unknown): SaveFailureKind {
  if (!(err instanceof VoxaSyncError)) return 'retry';
  const { status } = err;
  if (status === 422) return 'motor-plan';
  if (status === 401 || status === 408 || status === 429 || status >= 500) return 'retry';
  return 'rejected';
}
