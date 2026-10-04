import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hygieneHits } from './hygiene.mjs';

const rules = (rel, text) => hygieneHits(rel, text).map((h) => h.rule);

// Fixtures are assembled at runtime so this file holds no literal of the kind
// the guard forbids (the guard skips scripts/guards/** anyway).
const ip = (...parts) => parts.join('.');
const uuid = ['3f2a9c1e', '7b4d', '4e21', '9a0c', '5d6e7f8a9b0c'].join('-');

describe('public-repo hygiene guard', () => {
  it('fails on RFC 1918 addresses and passes on public ones', () => {
    for (const addr of [ip(10, 0, 0, 12), ip(172, 16, 4, 1), ip(172, 31, 255, 255), ip(192, 168, 1, 20)]) {
      assert.deepEqual(rules('k8s/production/configmap.yaml', `host: ${addr}`), ['rfc1918-address'], addr);
    }
    for (const text of [ip(172, 32, 0, 1), ip(8, 8, 8, 8), ip(127, 0, 0, 1), `version ${ip(1, 10, 0, 1)}`, ip(10, 0, 0, 1) + '.5']) {
      assert.deepEqual(rules('docs/x.md', text), [], text);
    }
  });

  it('passes on RFC 1918 addresses in test fixtures and SVG path data', () => {
    assert.deepEqual(rules('apps/api/src/lib/net.test.ts', ip(10, 1, 2, 3)), []);
    assert.deepEqual(rules('apps/web/public/symbols/mulberry/EN/rice.svg', `d="M${ip(10, 5, 3, 2)}"`), []);
  });

  it('fails on cluster-internal DNS names', () => {
    const name = ['api', 'some-ns', 'svc', 'cluster', 'local'].join('.');
    assert.deepEqual(rules('apps/api/src/config.ts', `http://${name}:4000`), ['cluster-internal-dns']);
  });

  it('fails on the operator SSH host pattern', () => {
    const host = ['ssh', 'example', 'io'].join('.');
    assert.deepEqual(rules('docs/ops/RUNBOOK.md', `ssh ${host}`), ['operator-ssh-host']);
    assert.deepEqual(rules('docs/ops/RUNBOOK.md', 'cloudflared access ssh --hostname x'), ['operator-ssh-host']);
  });

  it('fails on Cloudflare tunnel ids', () => {
    assert.deepEqual(rules('enclii.yaml', `tunnel_id: ${uuid}`), ['cloudflare-tunnel-id']);
    assert.deepEqual(rules('docs/deploy/x.md', `${uuid}.cfargotunnel.com`), ['cloudflare-tunnel-id']);
    // A bare UUID (board id, fixture) is not a tunnel id.
    assert.deepEqual(rules('apps/api/src/x.ts', `boardId: '${uuid}'`), []);
  });

  it('fails on staff addresses and passes on role mailboxes', () => {
    const domain = ['madfam', 'io'].join('.');
    assert.deepEqual(rules('docs/x.md', `write to first.last@${domain}`), ['staff-email-address']);
    assert.deepEqual(rules('docs/x.md', `write to someone@ops.${domain}`), ['staff-email-address']);
    for (const role of ['hola', 'legal', 'security', 'privacidad', 'soporte']) {
      assert.deepEqual(rules('docs/legal/PRIVACY.md', `${role}@${domain}`), [], role);
    }
  });

  it('skips the guard itself and the lockfile', () => {
    assert.deepEqual(rules('scripts/guards/hygiene.mjs', ip(10, 0, 0, 1)), []);
    assert.deepEqual(rules('pnpm-lock.yaml', ip(10, 0, 0, 1)), []);
  });
});
