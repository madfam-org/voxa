import { NextResponse } from 'next/server';
import { missingAuthEnv } from '../../../../lib/auth-env';
import { AUTH_PUBLIC_HOSTS_KEY, invalidPublicHostEntries } from '../../../../lib/public-origin';

/**
 * Readiness probe (Kubernetes `readinessProbe`).
 *
 * Liveness stays on `/api/health`, which only proves the process answers.
 * Readiness also requires what sign-in needs: the session secret
 * (`AUTH_SECRET`) and the Janua client (`AUTH_JANUA_ISSUER`,
 * `AUTH_JANUA_CLIENT_ID`, `AUTH_JANUA_CLIENT_SECRET`). A pod without them
 * cannot sign anyone in, so it receives no traffic; with surge-first
 * rollouts (`maxUnavailable: 0`) a rollout missing a secret stalls on the
 * previous pods instead of replacing them.
 *
 * A malformed `AUTH_PUBLIC_HOSTS` entry (anything but a host name with an
 * optional port) is reported as `invalid`: such a pod would answer sign-in
 * with 400 on the host the entry meant to allow.
 *
 * The response names missing or invalid settings only; it never echoes values.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const missing = missingAuthEnv();
  const invalid = invalidPublicHostEntries().length > 0 ? [AUTH_PUBLIC_HOSTS_KEY] : [];
  if (missing.length > 0 || invalid.length > 0) {
    return NextResponse.json(
      { status: 'unavailable', service: 'voxa-web', missing, ...(invalid.length > 0 ? { invalid } : {}) },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json(
    { status: 'ready', service: 'voxa-web' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
