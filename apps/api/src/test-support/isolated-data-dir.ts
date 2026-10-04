/**
 * Test preload (`node --import ./src/test-support/isolated-data-dir.ts --test …`).
 *
 * `node --test` runs every test file in its own process, in parallel, and
 * forwards `--import` flags to each of them. Without this preload every one
 * of those processes reads and writes the same `./data/boards.json`, so one
 * file could read another's half-written JSON ("Unexpected end of JSON
 * input") or another file's boards. Each process gets its own empty data
 * directory instead, removed when the process exits.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'voxa-api-test-'));
process.env.VOXA_DATA_DIR = dataDir;

// Route tests identify callers with the development headers
// (`X-Voxa-User-Id` / `X-Voxa-Role`), which the API honours only when
// VOXA_DEV_AUTH=true outside production. Tests that check the fail-closed
// behaviour override these variables themselves.
process.env.VOXA_DEV_AUTH ??= 'true';

process.on('exit', () => {
  rmSync(dataDir, { recursive: true, force: true });
});
