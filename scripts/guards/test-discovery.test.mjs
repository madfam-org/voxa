import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { discoverTestFiles, EXCLUDED, REPO_ROOT } from '../run-unit-tests.mjs';
import { checkTestDiscovery, readBaseline } from './test-discovery.mjs';

describe('unit-test discovery', () => {
  it('runs every tracked unit test and every file the old lists ran', () => {
    const result = checkTestDiscovery();
    assert.deepEqual(result.problems, []);
    const baseline = readBaseline();
    // Read-proof: 93 files when discovery was written; later rebases only add.
    assert.ok(baseline.length >= 93, `the frozen pre-discovery list has only ${baseline.length} files`);
    assert.ok(result.discovered >= baseline.length, `discovered ${result.discovered} < ${baseline.length}`);
  });

  it('runner --list prints the same set the guard counts', () => {
    const out = execFileSync(process.execPath, [path.join(REPO_ROOT, 'scripts/run-unit-tests.mjs'), '--list'], {
      cwd: path.join(REPO_ROOT, 'packages/core'),
    }).toString();
    const listed = out.trim().split('\n');
    assert.ok(listed.includes('packages/core/src/visual-schedule.test.ts'), 'the file the old list forgot now runs');
    assert.ok(listed.every((rel) => rel.startsWith('packages/core/src/') && rel.endsWith('.test.ts')));
  });

  describe('discoverTestFiles', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'voxa-discovery-'));
    after(() => rmSync(dir, { recursive: true, force: true }));
    for (const rel of [
      'src/a.test.ts',
      'src/deep/b.test.tsx',
      'src/c.ts',
      'src/d.spec.ts',
      'src/node_modules/x/e.test.ts',
      'src/dist/f.test.ts',
      'other/g.test.ts',
    ]) {
      mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      writeFileSync(path.join(dir, rel), '');
    }

    it('finds *.test.* under src, nested, sorted; skips build output and node_modules', () => {
      assert.deepEqual(discoverTestFiles(dir), ['src/a.test.ts', 'src/deep/b.test.tsx']);
    });

    it('takes extra roots', () => {
      assert.deepEqual(discoverTestFiles(dir, ['src', 'other']), ['other/g.test.ts', 'src/a.test.ts', 'src/deep/b.test.tsx']);
    });

    it('honours EXCLUDED (repo-relative paths)', () => {
      const rel = path.relative(REPO_ROOT, path.join(dir, 'src/a.test.ts')).split(path.sep).join('/');
      EXCLUDED.set(rel, 'test');
      try {
        assert.deepEqual(discoverTestFiles(dir), ['src/deep/b.test.tsx']);
      } finally {
        EXCLUDED.delete(rel);
      }
    });
  });
});
