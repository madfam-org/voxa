#!/usr/bin/env node
// Unit-test runner for every workspace package: discovers test files instead
// of listing them by hand in package.json.
//
// Usage (from a package directory, which is how `pnpm test` / turbo run it):
//   node ../../scripts/run-unit-tests.mjs [--import <module>]... [--root <dir>]... [--no-tsx] [--list]
//
// - Discovers every `*.test.{ts,tsx,mts,cts,js,mjs}` under each root
//   (default `src`), skipping node_modules, dist, build output and the paths
//   in EXCLUDED below, sorts them and runs
//   `node --import tsx [--import <module>]... --test <files>`.
// - Works on Node 20 and Node 22: it walks the tree itself and passes plain
//   file paths, so it relies on neither `--test` glob support nor fs.globSync.
// - Fails (exit 1) when a package that calls it has no test file, so a
//   broken root or a moved directory cannot pass as "0 tests, all green".
// - `--list` prints the discovered files (repo-relative) and exits; the guard
//   scripts/guards/test-discovery.test.mjs uses it.
// - Service suites (A-032): `*.pg.test.*` need VOXA_TEST_DATABASE_URL and
//   `*.redis.test.*` need VOXA_TEST_REDIS_URL and VOXA_TEST_DATABASE_URL.
//   Locally, without them, those files skip themselves and this runner says
//   so. With CI set (GitHub Actions always sets CI=true), a missing variable
//   fails the run before any test starts, so a CI job without its database
//   cannot pass as a clean run. Whenever a variable is set, its host must
//   accept a TCP connection within 5 s, or the run fails (CI and local).
//
// Rule for contributors: a new `*.test.ts` under a package's `src/` runs
// without any registration. To keep a file out of the unit job, add it to
// EXCLUDED with the reason; never delete a test to make CI green.
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TEST_FILE = /\.test\.(ts|tsx|mts|cts|js|mjs)$/;

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.turbo', 'coverage', '.expo']);

/**
 * Repo-relative test files that must NOT run in the unit job, with the reason.
 *
 * Empty on purpose. Before discovery, the explicit lists in each package.json
 * ran every test file in the tree except `packages/core/src/visual-schedule.test.ts`,
 * which was simply never added (an oversight, not a choice: it passes and has
 * no external dependency), so it now runs. The suites that need something
 * outside the process gate themselves instead of being left off a list:
 * `*.pg.test.ts` skip without `VOXA_TEST_DATABASE_URL` (locally; CI fails, see
 * SERVICE_SUITES), and browser specs live
 * in `e2e/specs/*.spec.ts` (Playwright), which this runner never picks up.
 *
 * @type {Map<string, string>}
 */
export const EXCLUDED = new Map([
  // ['packages/example/src/slow.test.ts', 'needs a GPU; runs in the nightly job'],
]);

/** Walk `dir` and collect test files (absolute paths). */
function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (entry.isFile() && TEST_FILE.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
}

function toRepoRelative(file) {
  return path.relative(REPO_ROOT, file).split(path.sep).join('/');
}

/**
 * Test files a package runs, as paths relative to `packageDir`, sorted.
 * @param {string} packageDir absolute package directory
 * @param {string[]} roots directories relative to packageDir
 */
export function discoverTestFiles(packageDir, roots = ['src']) {
  const found = [];
  for (const root of roots) {
    const abs = path.resolve(packageDir, root);
    try {
      if (!statSync(abs).isDirectory()) continue;
    } catch {
      continue;
    }
    walk(abs, found);
  }
  return [...new Set(found)]
    .filter((file) => !EXCLUDED.has(toRepoRelative(file)))
    .map((file) => path.relative(packageDir, file).split(path.sep).join('/'))
    .sort();
}

/**
 * Suites that need a service outside the process, by file name. A file
 * matching `pattern` skips itself unless every variable in `vars` is set.
 */
export const SERVICE_SUITES = [
  { pattern: /\.pg\.test\./, service: 'PostgreSQL', vars: ['VOXA_TEST_DATABASE_URL'] },
  { pattern: /\.redis\.test\./, service: 'Redis', vars: ['VOXA_TEST_REDIS_URL', 'VOXA_TEST_DATABASE_URL'] },
];

/** True when `env.CI` is set to anything but an explicit false. */
export function isCi(env = process.env) {
  const value = (env.CI ?? '').trim().toLowerCase();
  return value !== '' && value !== 'false' && value !== '0';
}

/**
 * What the discovered files need from the environment:
 * `[{ service, files, missing }]` for each service with at least one file,
 * where `missing` lists the unset variables.
 * @param {string[]} files
 * @param {Record<string, string | undefined>} env
 */
export function serviceNeeds(files, env = process.env) {
  const needs = [];
  for (const suite of SERVICE_SUITES) {
    const count = files.filter((file) => suite.pattern.test(file)).length;
    if (count === 0) continue;
    const missing = suite.vars.filter((name) => !env[name]?.trim());
    needs.push({ service: suite.service, files: count, vars: suite.vars, missing });
  }
  return needs;
}

const DEFAULT_PORTS = { 'postgres:': 5432, 'postgresql:': 5432, 'redis:': 6379, 'rediss:': 6380 };

/** `{ host, port }` of a service URL, or null when it does not parse. */
export function serviceAddress(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  const port = Number(parsed.port || DEFAULT_PORTS[parsed.protocol]);
  if (!host || !Number.isInteger(port) || port <= 0) return null;
  return { host, port };
}

/** Resolves true when `host:port` accepts a TCP connection within `timeoutMs`. */
export function canConnect({ host, port }, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/**
 * Problems that must fail the run, and notes to print, for the service
 * suites among `files`. Never prints a URL (it can carry a password).
 */
export async function checkServiceSuites(files, env = process.env, connect = canConnect) {
  const problems = [];
  const notes = [];
  const ci = isCi(env);
  const probed = new Map();
  for (const need of serviceNeeds(files, env)) {
    const suites = `${need.files} ${need.service} suite${need.files === 1 ? '' : 's'}`;
    if (need.missing.length > 0) {
      const unset = `${need.missing.join(' and ')} ${need.missing.length === 1 ? 'is' : 'are'} not set`;
      if (ci) problems.push(`${suites} cannot run: ${unset} (CI requires them; a skipped suite is not a pass)`);
      else notes.push(`skipping ${suites}: ${unset} (CI fails instead)`);
      continue;
    }
    for (const name of need.vars) {
      if (!probed.has(name)) {
        const address = serviceAddress(env[name].trim());
        probed.set(name, address ? await connect(address) : false);
      }
      if (!probed.get(name)) {
        problems.push(`${suites} cannot run: ${name} does not parse or its host refuses connections`);
      }
    }
  }
  return { problems: [...new Set(problems)], notes };
}

function parseArgs(argv) {
  const opts = { imports: [], roots: [], tsx: true, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--import' || arg === '--root') {
      const value = argv[i + 1];
      if (!value) throw new Error(`${arg} needs a value`);
      (arg === '--import' ? opts.imports : opts.roots).push(value);
      i += 1;
    } else if (arg === '--no-tsx') {
      opts.tsx = false;
    } else if (arg === '--list') {
      opts.list = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (opts.roots.length === 0) opts.roots.push('src');
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const packageDir = process.cwd();
  const files = discoverTestFiles(packageDir, opts.roots);

  if (opts.list) {
    for (const file of files) console.log(toRepoRelative(path.resolve(packageDir, file)));
    return;
  }

  const where = toRepoRelative(packageDir) || '.';
  if (files.length === 0) {
    console.error(`run-unit-tests: no test files under ${opts.roots.join(', ')} in ${where}`);
    process.exit(1);
  }
  console.log(`run-unit-tests: ${files.length} test files in ${where}`);

  const services = await checkServiceSuites(files);
  for (const note of services.notes) console.log(`run-unit-tests: ${note}`);
  if (services.problems.length > 0) {
    for (const problem of services.problems) console.error(`run-unit-tests: FAIL ${problem}`);
    process.exit(1);
  }

  const nodeArgs = [];
  if (opts.tsx) nodeArgs.push('--import', 'tsx');
  for (const mod of opts.imports) nodeArgs.push('--import', mod);
  nodeArgs.push('--test', ...files);

  const result = spawnSync(process.execPath, nodeArgs, { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
