// Public-repo hygiene: patterns that must never be committed to this public
// repository (MADFAM repo-boundary contract). The guard reports the rule and
// file:line only, never the matched value, because CI logs are public too.
//
// The rules are patterns, not values: no internal hostname, address or tunnel
// id is written down here. Real client names are checked by MADFAM's private
// estate scan, not in this repository.
import { findRuleHits, matchesAny } from './lib.mjs';

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';

export const HYGIENE_RULES = {
  privateIp: {
    id: 'rfc1918-address',
    pattern: new RegExp(
      `(?<![\\d.])(?:10\\.${OCTET}|172\\.(?:1[6-9]|2\\d|3[01])|192\\.168)\\.${OCTET}\\.${OCTET}(?![\\d.]*\\d)`,
      'g',
    ),
  },
  clusterDns: { id: 'cluster-internal-dns', pattern: /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.svc\.cluster\.local\b/gi },
  sshHost: {
    // The operator SSH entry point is an `ssh.<domain>` host reached through a
    // tunnel client; neither belongs in a public repo.
    id: 'operator-ssh-host',
    pattern: /\bssh\.[a-z0-9-]+\.[a-z]{2,}\b|\bcloudflared\s+access\s+ssh\b/gi,
  },
  tunnelId: {
    id: 'cloudflare-tunnel-id',
    pattern:
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.cfargotunnel\.com\b|\btunnel(?:[_-]?id)?["']?\s*[:=]\s*["']?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  },
  staffEmail: {
    // Any address at the company domain whose local part is not a role mailbox.
    id: 'staff-email-address',
    pattern:
      /\b(?!(?:hola|hello|soporte|support|privacidad|privacy|seguridad|security|legal|ventas|sales|noreply|no-reply|dpo|contacto|contact|facturacion|billing|prensa|press|abuse|postmaster)@)[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*madfam\.io\b/gi,
  },
};

/** Files that may contain a rule's pattern, per rule id, with the reason. */
export const HYGIENE_ALLOWLIST = {
  // Documentation examples of private ranges live only in test fixtures.
  // SVG path data such as `10.5.3.2` is coordinates, not an address.
  'rfc1918-address': ['**/*.test.ts', '**/*.test.tsx', 'e2e/fixtures/**', 'fixtures/**', '**/*.svg'],
  // Service names the k8s manifests need (none today). Add a manifest here by
  // path, never a wildcard over the repo.
  'cluster-internal-dns': [],
  'operator-ssh-host': [],
  'cloudflare-tunnel-id': [],
  'staff-email-address': [],
};

/** The guard and its tests carry the patterns; the lockfile carries integrity strings. */
export const HYGIENE_SKIP = ['scripts/guards/**', 'pnpm-lock.yaml'];

/** Hygiene hits for one file. */
export function hygieneHits(rel, text) {
  if (text == null || matchesAny(rel, HYGIENE_SKIP)) return [];
  const rules = Object.values(HYGIENE_RULES).filter(
    (rule) => !matchesAny(rel, HYGIENE_ALLOWLIST[rule.id] ?? []),
  );
  return findRuleHits(text, rules);
}
