import { isValidMediaId } from './media-url';

/**
 * Server side of the same-origin media proxy (`GET /api/media/:id`).
 *
 * The API decides who may read a media asset (owner, or an editor/admin of
 * the board's organization; the shared demo board is readable by everyone):
 * `apps/api/src/routes/media.ts` with `canAccessBoard`. This proxy adds no
 * rule of its own and relaxes none: it forwards the signed-in session's
 * access token and passes the API's 401/403/404 through unchanged. The token
 * never reaches page scripts through this route.
 */
export const MEDIA_CACHE_CONTROL = 'private, max-age=86400';
const NO_STORE = 'no-store';
const MEDIA_TYPE = /^(image|audio|video)\/[A-Za-z0-9.+-]+$/;

export interface MediaProxyInput {
  id: string;
  /** The session's access token, or undefined when nobody is signed in. */
  accessToken: string | undefined;
  apiUrl: string;
  fetchImpl?: typeof fetch;
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': NO_STORE,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function proxyMediaRequest(input: MediaProxyInput): Promise<Response> {
  if (!isValidMediaId(input.id)) return jsonError(404, 'Not found');
  if (!input.accessToken) return jsonError(401, 'Unauthorized');

  const doFetch = input.fetchImpl ?? fetch;
  let upstream: Response;
  try {
    upstream = await doFetch(`${input.apiUrl.replace(/\/$/, '')}/v1/media/${input.id}`, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    return jsonError(502, 'Media unavailable');
  }

  if (upstream.status === 401 || upstream.status === 403 || upstream.status === 404) {
    await upstream.body?.cancel().catch(() => undefined);
    return jsonError(upstream.status, upstream.status === 404 ? 'Not found' : upstream.status === 403 ? 'Forbidden' : 'Unauthorized');
  }
  if (!upstream.ok) {
    await upstream.body?.cancel().catch(() => undefined);
    return jsonError(502, 'Media unavailable');
  }

  const contentType = upstream.headers.get('Content-Type') ?? '';
  if (!MEDIA_TYPE.test(contentType)) {
    await upstream.body?.cancel().catch(() => undefined);
    return jsonError(502, 'Media unavailable');
  }

  const headers = new Headers({
    'Content-Type': contentType,
    'Cache-Control': MEDIA_CACHE_CONTROL,
    // The answer depends on who is signed in: never reuse it for another session.
    Vary: 'Cookie',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
  });
  const length = upstream.headers.get('Content-Length');
  if (length && /^\d+$/.test(length)) headers.set('Content-Length', length);
  return new Response(upstream.body, { status: 200, headers });
}
