import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { isOidcConfigured } from '@/lib/auth';
import { buildContentSecurityPolicy, generateNonce } from '@/lib/security-headers';

const intlMiddleware = createMiddleware(routing);

function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || '/';
    }
  }
  return pathname;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/legal')
  );
}

function bypassIntlMiddleware(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname === '/auth/callback' ||
    pathname.startsWith('/auth/callback/') ||
    pathname === '/auth/signout' ||
    pathname.startsWith('/auth/signout/')
  );
}

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  return buildContentSecurityPolicy(nonce, {
    // The same expression the browser code uses for the API base (inlined at
    // build time), so the policy allows exactly the origin the app calls.
    // Production images always set NEXT_PUBLIC_API_URL (apps/web/Dockerfile).
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    oidcIssuers: [process.env.NEXT_PUBLIC_OIDC_ISSUER, process.env.OIDC_ISSUER],
    isDev,
  });
}

function withCsp(response: NextResponse, csp: string): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export function middleware(request: NextRequest) {
  const pathname = stripLocalePrefix(request.nextUrl.pathname);

  if (bypassIntlMiddleware(pathname)) {
    if (!isOidcConfigured() || isPublicPath(pathname)) {
      return NextResponse.next();
    }
    if (!request.cookies.get('voxa_session')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Next.js reads the nonce from the request's CSP header and stamps it on the
  // scripts it renders; next-intl forwards these request headers.
  const nonce = generateNonce();
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const intlResponse = withCsp(
    intlMiddleware(new NextRequest(request, { headers: requestHeaders })),
    csp,
  );

  if (!isOidcConfigured() || isPublicPath(pathname)) {
    return intlResponse;
  }

  if (!request.cookies.get('voxa_session')) {
    const url = request.nextUrl.clone();
    const localePrefix = routing.locales.find(
      (locale) =>
        request.nextUrl.pathname === `/${locale}` ||
        request.nextUrl.pathname.startsWith(`/${locale}/`),
    ) ?? routing.defaultLocale;
    url.pathname =
      localePrefix === routing.defaultLocale
        ? '/auth/signin'
        : `/${localePrefix}/auth/signin`;
    url.searchParams.set('redirect_to', pathname);
    return withCsp(NextResponse.redirect(url), csp);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // Crawling files are route handlers at the app root (app/robots.txt etc.):
    // no locale rewrite and no sign-in redirect.
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|manifest.webmanifest|robots.txt|sitemap.xml|llms.txt|icons/|symbols/).*)',
  ],
};
