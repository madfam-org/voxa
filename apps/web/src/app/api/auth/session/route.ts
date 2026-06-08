import { NextResponse } from 'next/server';
import { decodeJwt } from 'jose';
import { mapTeamRoleFromClaims } from '@voxa/core';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  let teamRole = 'communicator' as ReturnType<typeof mapTeamRoleFromClaims>;
  try {
    teamRole = mapTeamRoleFromClaims(decodeJwt(session.access_token) as Record<string, unknown>);
  } catch {
    /* keep communicator default */
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user_id,
      email: session.email,
      name: session.name,
    },
    accessToken: session.access_token,
    teamRole,
  });
}
