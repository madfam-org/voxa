/**
 * Graceful shutdown for the API process (A-029).
 *
 * Kubernetes runs the `preStop` hook (`sleep 5`, so the endpoint removal
 * reaches the Service and the tunnel), then sends SIGTERM and kills the pod
 * when `terminationGracePeriodSeconds` (30) runs out. That leaves about 25 s
 * after SIGTERM; the default deadline here (20 s) stays below it, so this
 * process exits on its own terms instead of being killed mid-request.
 *
 * On the first SIGTERM or SIGINT, in order:
 * 1. Mark the replica not ready: `/health/ready` answers 503 from now on.
 * 2. Stop background work (the utterance retention timer).
 * 3. Close every WebSocket with 1001 (going away), so clients reconnect to
 *    another replica (a client that does not answer within 2 s is dropped),
 *    and stop accepting connections: `server.close()` is awaited, so requests
 *    already in flight finish.
 * 4. Close the sync hub (Redis) and the database pool.
 * 5. Exit 0.
 *
 * A second signal, an error in step 3, or the deadline exits 1.
 */

/** The part of `http.Server` shutdown needs. */
export interface ClosableServer {
  close(callback?: (err?: Error) => void): unknown;
  /** Node >= 18.2: ends keep-alive connections that carry no request. */
  closeIdleConnections?(): void;
}

export interface ShutdownSteps {
  server: ClosableServer;
  /** Flips readiness to 503. */
  markNotReady(): void;
  /** Stops timers and other background work. */
  stopBackground(): void | Promise<void>;
  /** Closes every WebSocket with 1001; resolves when they are closed. */
  closeWebSockets(): void | Promise<void>;
  /** Closed after the server, in order (sync hub, then database). */
  closeResources: Array<{ name: string; close(): Promise<void> }>;
  /** Milliseconds from the first signal to a forced exit 1. */
  deadlineMs: number;
  exit(code: number): void;
  log?(message: string): void;
  logError?(message: string, err?: unknown): void;
}

/** The part of a `ws` WebSocket that closeSockets needs. */
export interface ClosableSocket {
  readonly readyState: number;
  readonly CLOSED: number;
  once(event: 'close', listener: () => void): unknown;
  close(code: number, reason: string): void;
  terminate(): void;
}

/** 1001 "going away": the server is leaving; clients reconnect elsewhere. */
export const WS_GOING_AWAY = 1001;

/** How long a client has to answer the close frame before its socket is dropped. */
export const WS_CLOSE_GRACE_MS = 2_000;

/**
 * Sends every open socket a 1001 close frame and resolves once all of them are
 * closed. A client that does not answer within `graceMs` (the `ws` default
 * would wait 30 s) has its socket dropped, so one stuck client cannot hold the
 * shutdown until the deadline.
 */
export function closeSockets(
  sockets: Iterable<ClosableSocket>,
  reason: string,
  graceMs: number = WS_CLOSE_GRACE_MS,
): Promise<void> {
  return Promise.all(
    [...sockets].map(
      (socket) =>
        new Promise<void>((resolve) => {
          if (socket.readyState === socket.CLOSED) return resolve();
          const timer = setTimeout(() => socket.terminate(), graceMs);
          socket.once('close', () => {
            clearTimeout(timer);
            resolve();
          });
          socket.close(WS_GOING_AWAY, reason);
        }),
    ),
  ).then(() => undefined);
}

/** Default deadline: below terminationGracePeriodSeconds (30 s) minus preStop (5 s). */
export const DEFAULT_SHUTDOWN_DEADLINE_MS = 20_000;

/** `SHUTDOWN_DEADLINE_MS` when it is a positive integer, else the default. */
export function shutdownDeadlineFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.SHUTDOWN_DEADLINE_MS?.trim();
  if (!raw) return DEFAULT_SHUTDOWN_DEADLINE_MS;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_SHUTDOWN_DEADLINE_MS;
}

function closeServer(server: ClosableServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      // ERR_SERVER_NOT_RUNNING: already closed, which is the goal.
      if (err && (err as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') reject(err);
      else resolve();
    });
    // Idle keep-alive sockets would otherwise hold close() open until they
    // time out; sockets with a request in flight are left to finish.
    server.closeIdleConnections?.();
  });
}

/**
 * Returns the signal handler. Call it for every SIGTERM/SIGINT; the first call
 * starts the shutdown, any later call exits 1 at once.
 */
export function createShutdown(steps: ShutdownSteps): (signal: string) => Promise<void> {
  const log = steps.log ?? ((message: string) => console.log(message));
  const logError =
    steps.logError ?? ((message: string, err?: unknown) => console.error(message, err ?? ''));
  let started = false;
  let exited = false;
  const exitOnce = (code: number) => {
    if (exited) return;
    exited = true;
    steps.exit(code);
  };

  return async (signal: string) => {
    if (started) {
      logError(`[voxa] ${signal} during shutdown: exiting now`);
      exitOnce(1);
      return;
    }
    started = true;
    log(`[voxa] ${signal}: draining (deadline ${steps.deadlineMs} ms)`);

    const deadline = setTimeout(() => {
      logError(`[voxa] shutdown did not finish within ${steps.deadlineMs} ms: exiting`);
      exitOnce(1);
    }, steps.deadlineMs);
    deadline.unref?.();

    let code = 0;
    steps.markNotReady();
    try {
      await steps.stopBackground();
    } catch (err) {
      logError('[voxa] failed to stop background work on shutdown', err);
    }
    try {
      await Promise.all([steps.closeWebSockets(), closeServer(steps.server)]);
    } catch (err) {
      code = 1;
      logError('[voxa] failed to close the HTTP server on shutdown', err);
    }
    for (const resource of steps.closeResources) {
      try {
        await resource.close();
      } catch (err) {
        logError(`[voxa] failed to close the ${resource.name} on shutdown`, err);
      }
    }
    clearTimeout(deadline);
    if (code === 0) log('[voxa] shutdown complete');
    exitOnce(code);
  };
}

let shuttingDown = false;

/** Readiness answers 503 from now on (step 1 above). */
export function markShuttingDown(): void {
  shuttingDown = true;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

/** Test helper: back to serving. */
export function resetShuttingDownForTests(): void {
  shuttingDown = false;
}
