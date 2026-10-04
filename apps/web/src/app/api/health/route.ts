import { NextResponse } from 'next/server';
import { buildSha } from '../../../lib/build-info';

// Read at request time: `build` and `oidcClientSecretSet` come from the
// runtime environment, never from the build.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'voxa-web',
    version: '0.5.0',
    build: buildSha(),
    oidcClientSecretSet: Boolean(process.env.OIDC_CLIENT_SECRET?.trim()),
  });
}
