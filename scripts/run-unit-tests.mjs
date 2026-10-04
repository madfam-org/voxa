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
//
// Rule for contributors: a new `*.test.ts` under a package's `src/` runs
// without any registration. To keep a file out of the unit job, add it to
// EXCLUDED with the reason; never delete a test to make CI green.
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
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
 * `*.pg.test.ts` skip without `VOXA_TEST_DATABASE_URL`, and browser specs live
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

function main() {
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

  const nodeArgs = [];
  if (opts.tsx) nodeArgs.push('--import', 'tsx');
  for (const mod of opts.imports) nodeArgs.push('--import', mod);
  nodeArgs.push('--test', ...files);

  const result = spawnSync(process.execPath, nodeArgs, { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
