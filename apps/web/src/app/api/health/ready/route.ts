import { NextResponse } from 'next/server';
import { isOidcConfigured } from '../../../../lib/auth';

/**
 * Readiness probe (Kubernetes `readinessProbe`).
 *
 * Liveness stays on `/api/health`, which only proves the process answers.
 * Readiness also requires the configuration the web needs to serve what it
 * advertises: a pod without OIDC issuer and client id cannot sign anyone in,
 * so it must not receive traffic. With surge-first rollouts this makes a
 * misconfigured rollout stall on the previous pods instead of replacing them.
 *
 * The response names missing settings only; it never echoes values.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isOidcConfigured()) {
    return NextResponse.json(
      { status: 'unavailable', service: 'voxa-web', missing: ['oidc'] },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json(
    { status: 'ready', service: 'voxa-web' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
