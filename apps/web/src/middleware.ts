import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { routing } from '@/i18n/routing';
import { isAuthConfigured } from '@/lib/auth-env';
import { bypassesIntl, gateDecision, stripLocalePrefix } from '@/lib/route-gate';
import { buildContentSecurityPolicy, generateNonce } from '@/lib/security-headers';

const intlMiddleware = createMiddleware(routing);

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  return buildContentSecurityPolicy(nonce, {
    // The browser opens the live-sync WebSocket to the API origin (HTTP calls
    // go through the same-origin proxy). Production images always set
    // NEXT_PUBLIC_API_URL (apps/web/Dockerfile).
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    // Sign-in and sign-out navigate to Janua (form-action covers the redirect).
    oidcIssuers: [process.env.AUTH_JANUA_ISSUER],
    isDev,
  });
}

function withCsp(response: NextResponse, csp: string): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

/**
 * Locale routing, the nonce CSP and the sign-in gate. `auth()` wraps it: it
 * decrypts the session cookie, runs the refresh when the access token is due
 * and writes the rotated session back on this response; `request.auth` is
 * null for a missing, expired or unrefreshable session.
 */
export default auth((request) => {
  const pathname = stripLocalePrefix(request.nextUrl.pathname, routing.locales);
  if (bypassesIntl(pathname)) return NextResponse.next();

  // Next.js reads the nonce from the request's CSP header and stamps it on the
  // scripts it renders; next-intl forwards these request headers.
  const nonce = generateNonce();
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const decision = gateDecision({
    pathname,
    authConfigured: isAuthConfigured(),
    hasValidSession: Boolean(request.auth),
  });
  if (decision === 'signin') {
    const url = request.nextUrl.clone();
    const localePrefix =
      routing.locales.find(
        (locale) =>
          request.nextUrl.pathname === `/${locale}` || request.nextUrl.pathname.startsWith(`/${locale}/`),
      ) ?? routing.defaultLocale;
    url.pathname = localePrefix === routing.defaultLocale ? '/auth/signin' : `/${localePrefix}/auth/signin`;
    url.search = '';
    url.searchParams.set('redirect_to', pathname);
    return withCsp(NextResponse.redirect(url), csp);
  }

  return withCsp(intlMiddleware(new NextRequest(request, { headers: requestHeaders })), csp);
});

export const config = {
  matcher: [
    // Crawling files are route handlers at the app root (app/robots.txt etc.):
    // no locale rewrite and no sign-in redirect.
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|manifest.webmanifest|robots.txt|sitemap.xml|llms.txt|llms-full.txt|icons/|symbols/).*)',
  ],
};
