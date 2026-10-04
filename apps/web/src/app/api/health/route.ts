import { NextResponse } from 'next/server';
import { AUTH_ENV_KEYS } from '../../../lib/auth-env';
import { buildSha } from '../../../lib/build-info';

// Read at request time: `build` and `auth` come from the runtime environment,
// never from the build.
export const dynamic = 'force-dynamic';

/**
 * Liveness and configuration overview. Booleans only for the sign-in
 * settings: whether each is present, never its value.
 */
export async function GET() {
  const auth = Object.fromEntries(
    AUTH_ENV_KEYS.map((key) => [key, Boolean(process.env[key]?.trim())]),
  ) as Record<(typeof AUTH_ENV_KEYS)[number], boolean>;
  return NextResponse.json({
    status: 'ok',
    service: 'voxa-web',
    version: '0.5.0',
    build: buildSha(),
    auth,
  });
}
