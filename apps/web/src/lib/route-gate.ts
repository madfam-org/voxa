/**
 * Which pages need a signed-in session. The middleware decides from a VALID
 * Auth.js session (`auth()`: decrypted, not expired, refreshed when due),
 * never from the mere presence of a cookie.
 */
export function stripLocalePrefix(pathname: string, locales: readonly string[]): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1) || '/';
  }
  return pathname;
}

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/legal')
  );
}

/** Route handlers that must not get the locale rewrite. */
export function bypassesIntl(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname === '/auth/signout' || pathname.startsWith('/auth/signout/');
}

/** `signin` when the page needs a session the request does not have. */
export function gateDecision(input: {
  pathname: string;
  authConfigured: boolean;
  hasValidSession: boolean;
}): 'allow' | 'signin' {
  if (!input.authConfigured || isPublicPath(input.pathname)) return 'allow';
  return input.hasValidSession ? 'allow' : 'signin';
}
