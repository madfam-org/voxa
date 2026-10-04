import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Guard: no product source may reach the removed, non-commercial symbol
 * library. Scans every file under apps/<app>/src and packages/<pkg>/src.
 *
 * Exempt: tests (*.test.* / *.spec.*), the legacy-render shim
 * (packages/symbols/src/legacy.ts), and the files listed in PENDING_REMOVAL —
 * each entry names the change that removes it; delete the entry when it lands.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const FORBIDDEN = ['static.arasaac.org', 'api.arasaac.org'];

const SHIM = new Set(['packages/symbols/src/legacy.ts']);

const PENDING_REMOVAL = new Set([
  // Demo/core board content moves to Mulberry + label-only in the content PR
  // (core symbol allow-map). Remove this entry once that change is on main.
  'packages/core/src/demo-experience.ts',
]);

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
