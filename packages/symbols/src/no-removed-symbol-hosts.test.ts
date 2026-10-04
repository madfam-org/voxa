import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Guard: no product source may reach the removed, non-commercial symbol
 * library. Scans every file under apps/<app>/src and packages/<pkg>/src.
 *
 * Exempt: tests (*.test.* / *.spec.*) and the legacy-render shim
 * (packages/symbols/src/legacy.ts). PENDING_REMOVAL is empty.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const FORBIDDEN = ['static.arasaac.org', 'api.arasaac.org'];

const SHIM = new Set(['packages/symbols/src/legacy.ts']);

// Files allowed to keep a removed-library host until the change that removes
// it lands. Keep empty; add an entry only with the PR that will delete it.
const PENDING_REMOVAL = new Set<string>([]);

const SOURCE_EXT = /\.(c|m)?(t|j)sx?$/;
const TEST_FILE = /\.(test|spec)\.(c|m)?(t|j)sx?$/;

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry.name) && !TEST_FILE.test(entry.name)) out.push(full);
  }
}

function sourceRoots(): string[] {
  const roots: string[] = [];
  for (const group of ['apps', 'packages']) {
    for (const entry of readdirSync(path.join(repoRoot, group), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const src = path.join(repoRoot, group, entry.name, 'src');
      try {
        readdirSync(src);
        roots.push(src);
      } catch {
        // package without src/
      }
    }
  }
  return roots;
}

describe('no product source reaches the removed symbol library', () => {
  it('scans apps/*/src and packages/*/src', () => {
    const files: string[] = [];
    for (const root of sourceRoots()) walk(root, files);
    // Read-proof: an empty scan must fail rather than pass silently.
    assert.ok(files.length > 100, `only ${files.length} source files scanned`);

    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(repoRoot, file).split(path.sep).join('/');
      if (SHIM.has(rel) || PENDING_REMOVAL.has(rel)) continue;
      const text = readFileSync(file, 'utf8');
      for (const host of FORBIDDEN) {
        if (text.includes(host)) offenders.push(`${rel}: ${host}`);
      }
    }
    assert.deepEqual(offenders, []);
  });
});
