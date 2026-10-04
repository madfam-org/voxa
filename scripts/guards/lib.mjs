// Shared helpers for the repository guards (scripts/guards/*.mjs).
// Plain Node (no dependencies, no TypeScript) so the guards run before
// `pnpm install` and on Node 20 or 22.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Tracked files, repo-relative with forward slashes (what ships in the public repo). */
export function trackedFiles(root = REPO_ROOT) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  return out.toString('utf8').split('\0').filter(Boolean);
}

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|icns|avif|bmp|tiff?|woff2?|ttf|otf|eot|mp3|mp4|m4a|wav|ogg|webm|mov|pdf|zip|obz|gz|tgz|jar|keystore|p12|der)$/i;

/** File text, or null for binary files (by extension or a NUL byte in the first 8 KiB). */
export function readText(rel, root = REPO_ROOT) {
  if (BINARY_EXT.test(rel)) return null;
  let buf;
  try {
    buf = readFileSync(path.join(root, rel));
  } catch {
    return null; // deleted in the working tree but still in the index
  }
  if (buf.subarray(0, 8192).includes(0)) return null;
  return buf.toString('utf8');
}

/**
 * Minimal glob → RegExp for allowlists: `**` any path (including `/`),
 * `*` anything but `/`, everything else literal. Anchored to the whole path.
 */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 1;
        if (glob[i + 1] === '/') i += 1;
      } else {
        re += '[^/]*';
      }
    } else {
      re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

/** True when `rel` matches any glob in `globs`. */
export function matchesAny(rel, globs) {
  return globs.some((g) => globToRegExp(g).test(rel));
}

/** 1-based line number of `index` in `text`. */
export function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

/**
 * Every match of every rule in `text`, as `{ rule, line }` (never the matched
 * value: guard output lands in public CI logs).
 * @param {string} text
 * @param {Array<{ id: string, pattern: RegExp }>} rules  patterns must carry the `g` flag
 */
export function findRuleHits(text, rules) {
  const hits = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(text)) !== null) {
      hits.push({ rule: rule.id, line: lineOf(text, m.index) });
      if (m[0].length === 0) rule.pattern.lastIndex += 1;
    }
  }
  return hits;
}
