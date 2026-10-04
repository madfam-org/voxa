import { proxyApiRequest } from '@/lib/api-proxy';
import { voxaApiUrl } from '@/lib/api-origin';
import { sessionForRequest } from '@/lib/route-session';
import { isSameOriginRequest } from '@/lib/same-origin';
import { withSessionCookies } from '@/lib/server-session';

/**
 * Same-origin proxy to the Voxa API: the browser sends its session cookie, the
 * server adds the bearer. Rules in `src/lib/api-proxy.ts`.
 */
export const dynamic = 'force-dynamic';

async function handle(request: Request): Promise<Response> {
  let setCookies: string[] = [];
  const response = await proxyApiRequest({
    request,
    sameOrigin: isSameOriginRequest(request),
    apiUrl: voxaApiUrl(),
    accessToken: async () => {
      const session = await sessionForRequest(request);
      setCookies = session.setCookies;
      return session.token?.accessToken;
    },
  });
  return withSessionCookies(response, setCookies);
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
