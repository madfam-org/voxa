import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'voxa-web',
    version: '0.5.0',
    oidcClientSecretSet: Boolean(process.env.OIDC_CLIENT_SECRET?.trim()),
  });
}
