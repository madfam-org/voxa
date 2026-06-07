import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  exchangeCode,
  oidcTransientCookieAttrs,
  parseOidcStateCookie,
  sessionCookieAttrs,
  SESSION_COOKIE_NAME,
  SESSION_DISPLAY_COOKIE_NAME,
  verifyIdToken,
  type VoxaSession,
} from '@/lib/auth';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || url.origin;

  const failure = (reason: string) => {
    const response = NextResponse.redirect(
      `${baseUrl}/auth/signin?error=${encodeURIComponent(reason)}`,
    );
    response.cookies.set('voxa_pkce_verifier', '', { ...oidcTransientCookieAttrs(0), maxAge: 0 });
    response.cookies.set('voxa_oidc_state', '', { ...oidcTransientCookieAttrs(0), maxAge: 0 });
    return response;
  };

  if (errorParam) return failure(errorParam);
  if (!code || !state) return failure('missing_code_or_state');

  const store = await cookies();
  const verifier = store.get('voxa_pkce_verifier')?.value;
  const stateCookie = store.get('voxa_oidc_state')?.value;
  const resolved = parseOidcStateCookie(state, stateCookie);
  if (!verifier || !resolved) return failure('state_mismatch');

  let tokens;
  try {
    tokens = await exchangeCode({
      code,
      redirectUri: `${baseUrl}/auth/callback`,
      codeVerifier: verifier,
    });
  } catch {
    return failure('token_exchange_failed');
  }

  if (!tokens.access_token || !tokens.id_token) return failure('missing_tokens');

  let claims;
  try {
    claims = await verifyIdToken(tokens.id_token);
  } catch {
    return failure('id_token_verification_failed');
  }

  const sub = String(claims.sub ?? '');
  const email = String(claims.email ?? '');
  const name = String(claims.name ?? claims.preferred_username ?? email);
  if (!sub || !email) return failure('missing_required_claims');

  const expiresIn = Number(tokens.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) return failure('invalid_token_expiry');

  const session: VoxaSession = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    user_id: sub,
    email,
    name,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  };

  const response = NextResponse.redirect(`${baseUrl}${resolved.redirect_to || '/'}`);
  response.cookies.set(SESSION_COOKIE_NAME, JSON.stringify(session), sessionCookieAttrs(expiresIn));
  response.cookies.set(
    SESSION_DISPLAY_COOKIE_NAME,
    JSON.stringify({ email, name }),
    { ...sessionCookieAttrs(expiresIn), httpOnly: false },
  );
  response.cookies.set('voxa_pkce_verifier', '', { ...oidcTransientCookieAttrs(0), maxAge: 0 });
  response.cookies.set('voxa_oidc_state', '', { ...oidcTransientCookieAttrs(0), maxAge: 0 });
  return response;
}
