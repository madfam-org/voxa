/**
 * Runs the API entry point (`src/index.ts`, through tsx) in a child process,
 * as a deployment would: one process per replica, its own port. Used by tests
 * that need real startup behaviour (fail-closed checks) or several replicas.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface ApiProcess {
  child: ChildProcess;
  url: string;
  /** stdout + stderr so far. */
  output(): string;
  /** Resolves with the exit code. */
  exited: Promise<number | null>;
  stop(): Promise<void>;
}

/** A TCP port that was free a moment ago. */
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Starts `src/index.ts` with exactly `env` (plus PATH), on 127.0.0.1 and a free
 * port unless PORT is given. Does not wait for it to listen: use `waitReady`.
 */
export async function spawnApi(env: Record<string, string | undefined>): Promise<ApiProcess> {
  const port = env.PORT ?? String(await freePort());
  const dataDir = mkdtempSync(join(tmpdir(), 'voxa-api-proc-'));
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      LISTEN_HOST: '127.0.0.1',
      VOXA_DATA_DIR: dataDir,
      ...env,
      PORT: port,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout?.on('data', (chunk) => (log += String(chunk)));
  child.stderr?.on('data', (chunk) => (log += String(chunk)));
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  const killOnExit = () => child.kill('SIGKILL');
  process.once('exit', killOnExit);
  void exited.then(() => {
    process.removeListener('exit', killOnExit);
    rmSync(dataDir, { recursive: true, force: true });
  });

  return {
    child,
    url: `http://127.0.0.1:${port}`,
    output: () => log,
    exited,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      await exited;
    },
  };
}

/** Polls `/health/ready` until it answers 200, or throws with the process output. */
export async function waitReady(api: ApiProcess, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (api.child.exitCode !== null) {
      throw new Error(`API exited early (code ${api.child.exitCode}):\n${api.output().slice(-2000)}`);
    }
    try {
      const res = await fetch(`${api.url}/health/ready`);
      if (res.status === 200) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`API not ready within ${timeoutMs} ms:\n${api.output().slice(-2000)}`);
}
