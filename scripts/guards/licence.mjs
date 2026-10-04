// Licence guard (ruling R86): the non-commercial pictogram library was removed
// from every product surface. Its name or hosts must not come back in shipped
// code, content, catalogs or vendored assets, and every vendored symbol set
// must carry its licence file and a NOTICE entry.
import { matchesAny } from './lib.mjs';

/** The removed library's name and any of its hosts, case-insensitive. */
export const REMOVED_LIBRARY = /arasaac/gi;

/**
 * Files that may name the removed library. Keep this short; every entry says why.
 * A new file that needs the name (say, a decision record) is added here in the
 * same PR so the exception is reviewed.
 */
export const LICENCE_ALLOWLIST = [
  // History: release notes and dated launch records written before R86.
  'CHANGELOG.md',
  'docs/launch/GA_CHECKLIST.md',
  'docs/launch/REMEDIATION_PLAN.md',
  // Explains why the vendored set replaced the removed one.
  'apps/web/public/symbols/mulberry/ATTRIBUTION.md',
  // Legacy-data compatibility: recognise boards saved before the removal and
  // render them label-only. Nothing here fetches from the removed hosts
  // (packages/symbols/src/no-removed-symbol-hosts.test.ts enforces that).
  'packages/symbols/src/legacy.ts',
  'packages/symbols/src/resolve.ts',
  'packages/core/src/symbol-ref.ts',
  'packages/core/src/index.ts',
  'apps/web/src/lib/communicator-settings.ts',
  // Guards that assert the library is absent, and their tests.
  'scripts/launch/verify-prod-demo.sh',
  'scripts/guards/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  'e2e/specs/*.spec.ts',
];

/** Repo-relative paths of vendored symbol sets: `apps/<app>/(public|assets)/symbols/<set>/`. */
export const SYMBOL_SET_ROOT = /^(apps\/[^/]+\/(?:public|assets)\/symbols\/[^/]+)\//;

const LICENCE_FILE = /^(LICEN[CS]E|COPYING|ATTRIBUTION)(\.[a-z]+)?$/i;

/** Hits of the removed library in one file (line numbers), unless allowlisted. */
export function licenceHits(rel, text, allowlist = LICENCE_ALLOWLIST) {
  if (matchesAny(rel, allowlist)) return [];
  const hits = [];
  REMOVED_LIBRARY.lastIndex = 0;
  if (REMOVED_LIBRARY.test(rel)) hits.push({ rule: 'removed-library-in-path', line: 0 });
  if (text != null) {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      REMOVED_LIBRARY.lastIndex = 0;
      if (REMOVED_LIBRARY.test(line)) hits.push({ rule: 'removed-library', line: i + 1 });
    });
  }
  return hits;
}

/**
 * Vendored symbol sets without a licence file at their root or without a
 * NOTICE entry naming their directory.
 * @param {string[]} files tracked repo-relative paths
 * @param {string} notice text of the root NOTICE file ('' when missing)
 * @returns {{ sets: string[], problems: string[] }}
 */
export function checkVendoredSymbolSets(files, notice) {
  const sets = new Map();
  for (const rel of files) {
    const m = SYMBOL_SET_ROOT.exec(rel);
    if (!m) continue;
    const root = m[1];
    if (!sets.has(root)) sets.set(root, []);
    sets.get(root).push(rel.slice(root.length + 1));
  }
  const problems = [];
  for (const [root, members] of sets) {
    if (!members.some((name) => LICENCE_FILE.test(name))) {
      problems.push(`${root}/: no LICENSE, LICENCE, COPYING or ATTRIBUTION file at the set root`);
    }
    if (!notice.includes(`${root}/`)) {
      problems.push(`${root}/: no entry in NOTICE (expected the path "${root}/")`);
    }
  }
  return { sets: [...sets.keys()].sort(), problems };
}
