// Workflow hygiene (A-026): least-privilege tokens and pinned actions in every
// GitHub Actions workflow.
//
//   workflow-no-top-level-permissions  no top-level `permissions:` key, so the
//                                       token gets the repository default
//   workflow-top-level-write           the top-level block grants a write scope
//                                       (or `write-all`); grant writes per job
//   workflow-action-unpinned           `uses:` an action or reusable workflow
//                                       by tag or branch, not a full commit SHA
//                                       (or a `docker://` image without a digest)
//   workflow-action-no-version         a pinned `uses:` without the version in a
//                                       trailing comment (`@<sha> # v4.4.0`),
//                                       which Dependabot updates with the SHA
//
// Plain text matching, no YAML dependency: the guards run before
// `pnpm install`. Local actions (`uses: ./…`) are not checked.
import { lineOf } from './lib.mjs';

/** True for files this guard reads. */
export function isWorkflowFile(rel) {
  return /^\.github\/workflows\/[^/]+\.ya?ml$/.test(rel);
}

const FULL_SHA = /^[0-9a-f]{40}$/;
const USES = /^[ \t]*(?:-[ \t]+)?uses:[ \t]*(['"]?)([^'"\s#]+)\1[ \t]*(#.*)?$/gm;

/** `{ rule, line }` for every problem in one workflow file (never the matched value). */
export function workflowHits(rel, text) {
  if (!isWorkflowFile(rel) || text == null) return [];
  const hits = [];

  const top = /^permissions:[ \t]*([^\n#]*)/m.exec(text);
  if (!top) {
    hits.push({ rule: 'workflow-no-top-level-permissions', line: 1 });
  } else {
    const inline = top[1].trim();
    if (inline) {
      if (/write/.test(inline)) hits.push({ rule: 'workflow-top-level-write', line: lineOf(text, top.index) });
    } else {
      // Block form: the indented lines under `permissions:`.
      const rest = text.slice(top.index + top[0].length).split('\n').slice(1);
      let offset = top.index + top[0].length + 1;
      for (const line of rest) {
        if (/^\S/.test(line)) break; // next top-level key
        if (/^\s+[a-z-]+:\s*write\b/.test(line)) {
          hits.push({ rule: 'workflow-top-level-write', line: lineOf(text, offset) });
        }
        offset += line.length + 1;
      }
    }
  }

  USES.lastIndex = 0;
  let m;
  while ((m = USES.exec(text)) !== null) {
    const ref = m[2];
    const comment = m[3] ?? '';
    const line = lineOf(text, m.index);
    if (ref.startsWith('./')) continue;
    if (ref.startsWith('docker://')) {
      if (!/@sha256:[0-9a-f]{64}$/.test(ref)) hits.push({ rule: 'workflow-action-unpinned', line });
      continue;
    }
    const at = ref.lastIndexOf('@');
    const version = at === -1 ? '' : ref.slice(at + 1);
    if (!FULL_SHA.test(version)) {
      hits.push({ rule: 'workflow-action-unpinned', line });
    } else if (!/^#\s*v?\d+(\.\d+)*\b/.test(comment)) {
      hits.push({ rule: 'workflow-action-no-version', line });
    }
  }
  return hits;
}
