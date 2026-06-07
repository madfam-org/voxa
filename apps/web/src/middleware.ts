import { NextResponse, type NextRequest } from 'next/server';
import { isOidcConfigured } from '@/lib/auth';

export function middleware(request: NextRequest) {
  if (!isOidcConfigured()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/legal')
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.get('voxa_session')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/signin';
    url.searchParams.set('redirect_to', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'],
};
