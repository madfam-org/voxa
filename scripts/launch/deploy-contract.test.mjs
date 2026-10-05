// Deploy contract between the k8s manifests and the deploy workflows.
//
// Two fixes from October 2026 depend on files that no unit test of the apps
// reads, so this test reads them directly (plain Node, `pnpm test:guards`):
//
// 1. Sign-in stays on the host the browser used (voxa#51, voxa#52; AGENTS.md
//    invariant 19). The web manifests must not set AUTH_URL (one origin cannot
//    serve the landing host and the app host), must allow-list exactly the
//    hosts their environment serves in AUTH_PUBLIC_HOSTS, and the web deploy
//    workflow of the same environment must run the strict auth smoke
//    (VERIFY_SAME_HOST=1) on exactly those hosts. Adding a host to one place
//    and not the other fails here.
// 2. cosign-installer is held at v3 (voxa#46): cosign v3 signatures are OCI 1.1
//    referrer bundles that the cluster's Kyverno does not verify yet. Every
//    deploy workflow must pin a v3 release, and Dependabot must keep ignoring
//    the installer's majors.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

const ENVIRONMENTS = [
  { name: 'production', manifest: 'k8s/production/voxa-web-deployment.yaml', workflow: '.github/workflows/deploy-voxa-web.yml' },
  { name: 'staging', manifest: 'k8s/staging/voxa-web-deployment.yaml', workflow: '.github/workflows/deploy-voxa-web-staging.yml' },
];

const DEPLOY_WORKFLOWS = [
  '.github/workflows/deploy-voxa-api.yml',
  '.github/workflows/deploy-voxa-web.yml',
  '.github/workflows/deploy-voxa-api-staging.yml',
  '.github/workflows/deploy-voxa-web-staging.yml',
];

/** Names of the container env entries (`- name: X`) in a manifest, comments ignored. */
export function envNames(manifest) {
  const names = [];
  for (const line of manifest.split('\n')) {
    const match = /^\s*-\s+name:\s*["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*(?:#.*)?$/.exec(line);
    if (match) names.push(match[1]);
  }
  return names;
}

/** The hosts of AUTH_PUBLIC_HOSTS in a manifest, or null when it is not set. */
export function publicHosts(manifest) {
  const match = /-\s+name:\s*AUTH_PUBLIC_HOSTS\s*\n\s*value:\s*"([^"]*)"/.exec(manifest);
  if (!match) return null;
  return match[1].split(',').map((h) => h.trim()).filter(Boolean);
}

/** Host lists given to the auth smoke in a workflow, per invocation, with its strict flag. */
export function smokeRuns(workflow) {
  const runs = [];
  for (const line of workflow.split('\n')) {
    const code = line.replace(/#.*$/, '');
    const match = /(VERIFY_SAME_HOST=1\s+)?(?:\S+=\S+\s+)*\.\/scripts\/launch\/verify-auth-public-origin\.sh((?:\s+[a-z0-9.-]+)+)\s*$/.exec(code);
    if (match) runs.push({ strict: Boolean(match[1]), hosts: match[2].trim().split(/\s+/) });
  }
  return runs;
}

/** Version comments of every sigstore/cosign-installer pin in a workflow. */
export function cosignInstallerPins(workflow) {
  const pins = [];
  for (const match of workflow.matchAll(/uses:\s*sigstore\/cosign-installer@([0-9a-f]{40})\s*#\s*(v\S+)/g)) {
    pins.push({ sha: match[1], version: match[2] });
  }
  return pins;
}

const sorted = (list) => [...list].sort();

describe('deploy contract: sign-in stays on the public host (voxa#51, voxa#52)', () => {
  for (const env of ENVIRONMENTS) {
    const manifest = read(env.manifest);
    const workflow = read(env.workflow);

    it(`${env.name}: the web manifest sets no AUTH_URL (nor NEXTAUTH_URL)`, () => {
      const names = envNames(manifest);
      assert.ok(names.includes('AUTH_JANUA_ISSUER'), `${env.manifest}: env not read (no AUTH_JANUA_ISSUER entry)`);
      assert.equal(names.includes('AUTH_URL'), false, `${env.manifest} sets AUTH_URL`);
      assert.equal(names.includes('NEXTAUTH_URL'), false, `${env.manifest} sets NEXTAUTH_URL`);
    });

    it(`${env.name}: AUTH_PUBLIC_HOSTS names the landing and the app host`, () => {
      const hosts = publicHosts(manifest);
      assert.ok(hosts, `${env.manifest}: AUTH_PUBLIC_HOSTS is not set`);
      assert.equal(hosts.length, 2, `${env.manifest}: expected the landing and the app host`);
      for (const host of hosts) assert.match(host, /^[a-z0-9-]+(\.[a-z0-9-]+)+$/, `${env.manifest}: ${host} is not a plain host`);
    });

    it(`${env.name}: the web deploy runs the strict auth smoke on exactly those hosts`, () => {
      const runs = smokeRuns(workflow);
      assert.ok(runs.length > 0, `${env.workflow}: no verify-auth-public-origin.sh run`);
      for (const run of runs) {
        assert.equal(run.strict, true, `${env.workflow}: auth smoke without VERIFY_SAME_HOST=1`);
        assert.deepEqual(sorted(run.hosts), sorted(publicHosts(manifest) ?? []), `${env.workflow}: smoke hosts differ from AUTH_PUBLIC_HOSTS`);
      }
    });
  }

  it('the helpers see a re-added AUTH_URL and a non-strict or partial smoke', () => {
    const manifest = '          env:\n            - name: AUTH_URL\n              value: "https://voxa.example"\n            # - name: COMMENTED\n';
    assert.deepEqual(envNames(manifest), ['AUTH_URL']);
    assert.deepEqual(publicHosts('            - name: AUTH_PUBLIC_HOSTS\n              value: "a.example, b.example"\n'), ['a.example', 'b.example']);
    assert.deepEqual(smokeRuns('          ./scripts/launch/verify-auth-public-origin.sh a.example'), [{ strict: false, hosts: ['a.example'] }]);
    assert.deepEqual(smokeRuns('          VERIFY_SAME_HOST=1 ./scripts/launch/verify-auth-public-origin.sh a.example b.example'), [
      { strict: true, hosts: ['a.example', 'b.example'] },
    ]);
    assert.deepEqual(smokeRuns('          # VERIFY_SAME_HOST=1 ./scripts/launch/verify-auth-public-origin.sh a.example'), []);
  });
});

describe('deploy contract: cosign-installer held at v3 (voxa#46)', () => {
  for (const rel of DEPLOY_WORKFLOWS) {
    it(`${path.basename(rel)} pins a v3 cosign-installer`, () => {
      const pins = cosignInstallerPins(read(rel));
      assert.ok(pins.length > 0, `${rel}: no sigstore/cosign-installer pin`);
      for (const pin of pins) assert.match(pin.version, /^v3\./, `${rel}: cosign-installer ${pin.version} (hold at v3 until Kyverno verifies cosign v3 bundles)`);
      // Installer v3 installs cosign v2 by default; an explicit release must stay on v2 too.
      for (const match of read(rel).matchAll(/cosign-release:\s*['"]?(v[0-9][^'"\s]*)/g)) {
        assert.match(match[1], /^v2\./, `${rel}: cosign-release ${match[1]} (cosign v3 signatures are not verified by the cluster yet)`);
      }
    });
  }

  it('Dependabot ignores cosign-installer majors', () => {
    const config = read('.github/dependabot.yml');
    assert.match(
      config,
      /-\s+dependency-name:\s*sigstore\/cosign-installer\s*\n\s*update-types:\s*\n\s*-\s*version-update:semver-major/,
      '.github/dependabot.yml: the cosign-installer major ignore is gone',
    );
  });

  it('the pin helper reads the version comment', () => {
    const sha = '398d4b0eeef1380460a10c8013a76f728fb906ac';
    assert.deepEqual(cosignInstallerPins(`        uses: sigstore/cosign-installer@${sha} # v4.1.2`), [{ sha, version: 'v4.1.2' }]);
  });
});
