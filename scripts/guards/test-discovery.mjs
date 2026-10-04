// Test-discovery guard: every tracked unit-test file runs in the unit job.
//
// 1. Every workspace package (apps/*, packages/*) whose src/ holds a test file
//    has a `test` script that calls scripts/run-unit-tests.mjs (so turbo runs
//    it and nothing is listed by hand).
// 2. Every tracked `*.test.*` under a package's src/ is discovered by the
//    runner or named in its EXCLUDED map.
// 3. Every file the hand-written lists ran before discovery
//    (fixtures/unit-tests-before-discovery.txt) is still discovered.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { discoverTestFiles, EXCLUDED, TEST_FILE } from '../run-unit-tests.mjs';
import { REPO_ROOT, trackedFiles } from './lib.mjs';

export const BASELINE_FILE = path.join(REPO_ROOT, 'scripts/guards/fixtures/unit-tests-before-discovery.txt');

const RUNNER = 'scripts/run-unit-tests.mjs';

export function readBaseline(file = BASELINE_FILE) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/** `{ dir, testScript }` for each workspace package under apps/ and packages/. */
function workspacePackages(files) {
  return files
    .filter((rel) => /^(apps|packages)\/[^/]+\/package\.json$/.test(rel))
    .map((rel) => {
      const dir = path.posix.dirname(rel);
      const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
      return { dir, testScript: pkg.scripts?.test ?? '' };
    });
}

export function checkTestDiscovery(files = trackedFiles()) {
  const problems = [];
  const discovered = new Set();
  const tracked = files.filter((rel) => /^(apps|packages)\/[^/]+\/src\//.test(rel) && TEST_FILE.test(rel));

  for (const { dir, testScript } of workspacePackages(files)) {
    const owned = tracked.filter((rel) => rel.startsWith(`${dir}/`));
    const usesRunner = testScript.includes(RUNNER);
    if (owned.length > 0 && !usesRunner) {
      problems.push(`${dir}/package.json: ${owned.length} test files, but its "test" script does not call ${RUNNER}`);
    }
    if (/\.test\.[cm]?[jt]sx?\b/.test(testScript)) {
      problems.push(`${dir}/package.json: the "test" script names test files by hand; let ${RUNNER} discover them`);
    }
    if (!usesRunner) continue;
    for (const rel of discoverTestFiles(path.join(REPO_ROOT, dir))) discovered.add(`${dir}/${rel}`);
  }

  for (const rel of tracked) {
    if (!discovered.has(rel) && !EXCLUDED.has(rel)) problems.push(`${rel}: tracked test file the unit job does not run`);
  }

  const baseline = readBaseline();
  const dropped = baseline.filter((rel) => !discovered.has(rel));
  for (const rel of dropped) problems.push(`${rel}: ran before discovery, not discovered now`);

  return { baseline: baseline.length, discovered: discovered.size, tracked: tracked.length, problems };
}
