import { voxaApiUrl } from '@/lib/api-origin';
import { proxyMediaRequest } from '@/lib/media-proxy';
import { sessionForRequest } from '@/lib/route-session';
import { withSessionCookies } from '@/lib/server-session';

/**
 * Same-origin, cookie-authenticated read of uploaded board media, so `<img>`,
 * `<audio>` and `<video>` can load it. See `src/lib/media-proxy.ts`. The
 * access token is read on the server from the encrypted session.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const session = await sessionForRequest(request);
  const response = await proxyMediaRequest({
    id,
    accessToken: session.token?.accessToken,
    apiUrl: voxaApiUrl(),
  });
  return withSessionCookies(response, session.setCookies);
}
