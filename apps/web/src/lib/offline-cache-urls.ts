/**
 * The same-origin URLs the service worker (`public/sw.js`) should keep for an
 * offline start: the current page when it is the app shell, build chunks,
 * icons and vendored pictograms. Session and media answers (`/api/*`) and any
 * other origin are never included.
 */
const SHELL_PATH = /^\/(?:(?:es|en|fr)\/)?app(?:\/edit)?\/?$/;

function isOfflineAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/symbols/') ||
    pathname === '/manifest.webmanifest'
  );
}

export function offlineCacheUrls(pageHref: string, loadedResources: string[]): string[] {
  let page: URL;
  try {
    page = new URL(pageHref);
  } catch {
    return [];
  }
  const urls = new Set<string>();
  if (SHELL_PATH.test(page.pathname)) {
    urls.add(new URL(page.pathname, page.origin).href);
  }
  for (const raw of loadedResources) {
    let url: URL;
    try {
      url = new URL(raw, page.origin);
    } catch {
      continue;
    }
    if (url.origin !== page.origin) continue;
    if (isOfflineAsset(url.pathname)) urls.add(url.href);
  }
  return [...urls];
}
