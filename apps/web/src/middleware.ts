import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { isOidcConfigured } from '@/lib/auth';

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

  const intlResponse = intlMiddleware(request);

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
    return NextResponse.redirect(url);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|manifest.webmanifest|icons/).*)',
  ],
};
