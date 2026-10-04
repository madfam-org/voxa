import { NextResponse } from 'next/server';
import { missingAuthEnv } from '../../../../lib/auth-env';

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
 * The response names missing settings only; it never echoes values.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const missing = missingAuthEnv();
  if (missing.length > 0) {
    return NextResponse.json(
      { status: 'unavailable', service: 'voxa-web', missing },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json(
    { status: 'ready', service: 'voxa-web' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
