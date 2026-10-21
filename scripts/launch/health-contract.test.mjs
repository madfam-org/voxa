// Health contract between the web's /api/health and the launch scripts that
// read it (plain Node, `pnpm test:guards`).
//
// voxa#33 replaced the web health field `oidcClientSecretSet` with an `auth`
// object holding one boolean per sign-in setting (AUTH_ENV_KEYS in
// apps/web/src/lib/auth-env.ts). The production GA gate kept grepping for the
// old field, so the Daily smoke failed every day from 2026-10-05 while
// production was healthy. This test fails when a script that checks the web
// health body stops checking one of the served keys, or checks a field the
// route no longer serves.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

const HEALTH_SCRIPTS = ['scripts/launch/verify-prod-ga.sh', 'scripts/launch/soak-daily-check.sh'];

function authEnvKeys() {
  const source = read('apps/web/src/lib/auth-env.ts');
  const block = source.match(/export const AUTH_ENV_KEYS = \[([\s\S]*?)\] as const;/);
  assert.ok(block, 'AUTH_ENV_KEYS not found in apps/web/src/lib/auth-env.ts');
  const keys = [...block[1].matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]);
  assert.ok(keys.length > 0, 'AUTH_ENV_KEYS is empty');
  return keys;
}

describe('web /api/health contract in the launch scripts', () => {
  const keys = authEnvKeys();

  it('the health route still serves the auth booleans from AUTH_ENV_KEYS', () => {
    const route = read('apps/web/src/app/api/health/route.ts');
    assert.match(route, /AUTH_ENV_KEYS/);
    assert.match(route, /\bauth,/);
    assert.doesNotMatch(route, /oidcClientSecretSet/);
  });

  for (const script of HEALTH_SCRIPTS) {
    it(`${script} checks every served auth key and no retired field`, () => {
      const body = read(script);
      assert.doesNotMatch(
        body,
        /oidcClientSecretSet/,
        `${script} still checks the retired oidcClientSecretSet field`,
      );
      const loop = body.match(
        /for key in ([A-Z0-9_ ]+); do\s*\n\s*check "Web auth\.\$\{key\} set" grep -q "\\"\$\{key\}\\":true"/,
      );
      assert.ok(loop, `${script} has no per-key auth check on the web health body`);
      assert.deepEqual(loop[1].trim().split(/\s+/).sort(), [...keys].sort());
    });
  }
});
