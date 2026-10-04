/**
 * Uploaded board media (images, recorded speech, GLP video) is stored on the
 * API and addressed in board data as `<api>/v1/media/:id`. That endpoint needs
 * a bearer token, which `<img>`, `<audio>` and `<video>` cannot send, so the
 * page loads it through the same-origin proxy `/api/media/:id`
 * (`app/api/media/[id]/route.ts`), which adds the signed-in session's token on
 * the server. Board data keeps the canonical API URL.
 */
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const MEDIA_PROXY_PREFIX = '/api/media/';

/** Media ids are server-generated UUIDs; anything else never reaches the API. */
const MEDIA_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidMediaId(id: string): boolean {
  return MEDIA_ID.test(id);
}

/** The media id of an `<api>/v1/media/:id` URL on the configured API origin, else null. */
export function mediaIdFromApiUrl(url: string | undefined, apiUrl: string = DEFAULT_API_URL): string | null {
  if (!url) return null;
  let parsed: URL;
  let api: URL;
  try {
    parsed = new URL(url);
    api = new URL(apiUrl);
  } catch {
    return null;
  }
  if (parsed.origin !== api.origin) return null;
  const match = /^\/v1\/media\/([^/]+)$/.exec(parsed.pathname);
  if (!match || !isValidMediaId(match[1]!)) return null;
  return match[1]!;
}

/**
 * The URL a media element should load: the same-origin proxy for API media,
 * anything else (vendored pictograms, `data:` URLs, other sources) unchanged.
 */
export function displayMediaUrl(
  url: string | undefined,
  apiUrl: string = DEFAULT_API_URL,
): string | undefined {
  const id = mediaIdFromApiUrl(url, apiUrl);
  return id ? `${MEDIA_PROXY_PREFIX}${id}` : url;
}
