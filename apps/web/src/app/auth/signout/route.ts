import { sessionForRequest } from '@/lib/route-session';
import { isSameOriginRequest } from '@/lib/same-origin';
import { signOutResponse } from '@/lib/sign-out';

/** Sign-out (POST only). See `src/lib/sign-out.ts`. */
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return signOutResponse(request, {
    sameOrigin: isSameOriginRequest(request),
    idToken: async () => (await sessionForRequest(request)).token?.idToken,
  });
}

export async function GET(request: Request): Promise<Response> {
  return signOutResponse(request, { sameOrigin: false, idToken: async () => undefined });
}
