/** Only same-origin absolute paths survive; anything that could name a host becomes `/app`. */
export function normalizeAuthRedirectPath(redirectTo: string | null | undefined, fallback = '/app'): string {
  if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//') || redirectTo.includes('\\')) {
    return fallback;
  }
  return redirectTo;
}
