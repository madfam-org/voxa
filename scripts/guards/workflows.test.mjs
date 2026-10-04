import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { workflowHits } from './workflows.mjs';

const SHA = '11d5960a326750d5838078e36cf38b85af677262';
const rules = (text, rel = '.github/workflows/ci.yml') => workflowHits(rel, text).map((h) => h.rule);

const header = 'name: CI\non:\n  push:\n    branches: [main]\n';
const readOnly = 'permissions:\n  contents: read\n';
const job = (step) => `jobs:\n  build:\n    runs-on: ubuntu-24.04\n    steps:\n${step}\n`;
const pinned = `      - uses: actions/checkout@${SHA} # v4.4.0`;

describe('workflow guard (A-026)', () => {
  it('passes a read-only workflow whose actions are pinned with a version comment', () => {
    assert.deepEqual(rules(header + readOnly + job(pinned)), []);
    assert.deepEqual(rules(header + 'permissions: {}\n' + job(pinned)), []);
    assert.deepEqual(rules(header + 'permissions: read-all\n' + job(pinned)), []);
  });

  it('passes per-job write grants under a read-only top level', () => {
    const text = `${header}${readOnly}jobs:\n  deploy:\n    permissions:\n      contents: write\n      packages: write\n      id-token: write\n    steps:\n${pinned}\n`;
    assert.deepEqual(rules(text), []);
  });

  it('fails a workflow without top-level permissions', () => {
    assert.deepEqual(rules(header + job(pinned)), ['workflow-no-top-level-permissions']);
    // A job-level block alone does not count as the top-level default.
    const jobOnly = `${header}jobs:\n  build:\n    permissions:\n      contents: read\n    steps:\n${pinned}\n`;
    assert.deepEqual(rules(jobOnly), ['workflow-no-top-level-permissions']);
  });

  it('fails a top-level write grant, block or inline', () => {
    assert.deepEqual(rules(header + 'permissions:\n  contents: read\n  packages: write\n' + job(pinned)), [
      'workflow-top-level-write',
    ]);
    assert.deepEqual(rules(header + 'permissions: write-all\n' + job(pinned)), ['workflow-top-level-write']);
    const hit = workflowHits('.github/workflows/x.yml', header + 'permissions:\n  packages: write\n' + job(pinned));
    assert.equal(hit[0].line, 6);
  });

  it('fails actions referenced by tag, branch or short SHA', () => {
    for (const ref of [
      'actions/checkout@v4',
      'docker/build-push-action@v7.4.0',
      'pnpm/action-setup@main',
      'actions/setup-node@49933ea',
      'org/repo/.github/workflows/reusable.yml@v1',
      'actions/checkout',
    ]) {
      assert.deepEqual(rules(header + readOnly + job(`      - uses: ${ref}`)), ['workflow-action-unpinned'], ref);
    }
  });

  it('checks quoted refs, `uses:` after a step name and job-level reusable workflows', () => {
    const step = `      - name: Checkout\n        uses: "actions/checkout@v4"`;
    assert.deepEqual(rules(header + readOnly + job(step)), ['workflow-action-unpinned']);
    const reusable = `${header}${readOnly}jobs:\n  call:\n    uses: org/repo/.github/workflows/r.yml@v1\n`;
    assert.deepEqual(rules(reusable), ['workflow-action-unpinned']);
  });

  it('fails a pinned action without its version in a trailing comment', () => {
    assert.deepEqual(rules(header + readOnly + job(`      - uses: actions/checkout@${SHA}`)), [
      'workflow-action-no-version',
    ]);
    assert.deepEqual(rules(header + readOnly + job(`      - uses: actions/checkout@${SHA} # latest`)), [
      'workflow-action-no-version',
    ]);
    assert.deepEqual(rules(header + readOnly + job(`      - uses: expo/expo-github-action@${SHA} # 8.2.1`)), []);
  });

  it('skips local actions and accepts docker images only by digest', () => {
    assert.deepEqual(rules(header + readOnly + job('      - uses: ./.github/actions/setup')), []);
    assert.deepEqual(rules(header + readOnly + job(`      - uses: docker://alpine@sha256:${'a'.repeat(64)}`)), []);
    assert.deepEqual(rules(header + readOnly + job('      - uses: docker://alpine:3.20')), ['workflow-action-unpinned']);
  });

  it('reports the line of each unpinned action', () => {
    const text = header + readOnly + job(`${pinned}\n      - uses: actions/setup-node@v4`);
    assert.deepEqual(workflowHits('.github/workflows/ci.yml', text), [{ rule: 'workflow-action-unpinned', line: 12 }]);
  });

  it('reads only .github/workflows/*.yml and *.yaml', () => {
    const bad = header + job('      - uses: actions/checkout@v4');
    assert.deepEqual(rules(bad, '.github/dependabot.yml'), []);
    assert.deepEqual(rules(bad, 'docs/ci-example.yml'), []);
    assert.deepEqual(rules(bad, '.github/workflows/deploy.yaml'), [
      'workflow-no-top-level-permissions',
      'workflow-action-unpinned',
    ]);
  });
});
