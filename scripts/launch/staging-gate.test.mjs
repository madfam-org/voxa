// Staging gate (plain Node, `pnpm test:guards`).
//
// Staging was retired on 2026-10-18. Every job aimed at staging runs only
// while the repository variable STAGING_ENABLED is 'true' (unset = skipped),
// and the production smoke never carries that gate. This test fails when a
// staging job loses its gate or the gate spreads to the production smoke.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

const GATE = "if: vars.STAGING_ENABLED == 'true'";

/** The lines of one top-level job (two-space indent) in a workflow file. */
function jobBlock(workflow, job) {
  const lines = read(workflow).split('\n');
  const start = lines.findIndex((line) => line === `  ${job}:`);
  assert.ok(start >= 0, `job ${job} not found in ${workflow}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line) || /^\S/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

const STAGING_JOBS = [
  ['.github/workflows/e2e-smoke.yml', 'staging-signed-in'],
  ['.github/workflows/deploy-voxa-api-staging.yml', 'build-and-push'],
  ['.github/workflows/deploy-voxa-web-staging.yml', 'build-and-push'],
];

describe('staging jobs run only while STAGING_ENABLED is true', () => {
  for (const [workflow, job] of STAGING_JOBS) {
    it(`${workflow} job ${job} carries the gate`, () => {
      assert.ok(
        jobBlock(workflow, job).includes(`    ${GATE}`),
        `${workflow} ${job} lacks "${GATE}"`,
      );
    });
  }

  it('the production smoke job has no staging gate', () => {
    assert.ok(!jobBlock('.github/workflows/e2e-smoke.yml', 'smoke').includes('STAGING_ENABLED'));
  });
});
